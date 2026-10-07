export const DEFAULT_RETRY_STATUSES = new Set([429, 500, 502, 503, 504, 520]);

export async function fetchWithRetry(input, init = {}, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    retries = 3,
    baseDelayMs = 750,
    retryStatuses = DEFAULT_RETRY_STATUSES,
    sleep = sleepFor,
    readResponse = (response) => response,
  } = options;
  const normalizedRetries = toNonNegativeInteger(retries, 3);
  const normalizedBaseDelayMs = toNonNegativeInteger(baseDelayMs, 750);
  const retryStatusSet =
    retryStatuses instanceof Set ? retryStatuses : new Set(retryStatuses);

  let lastError;

  for (let attempt = 0; attempt <= normalizedRetries; attempt += 1) {
    try {
      const response = await fetchImpl(input, init);
      if (
        response.ok ||
        !retryStatusSet.has(response.status) ||
        attempt === normalizedRetries
      ) {
        return await readResponse(response);
      }

      await sleep(resolveRetryDelayMs(response, normalizedBaseDelayMs, attempt));
    } catch (error) {
      lastError = error;
      if (
        attempt === normalizedRetries ||
        !isTransientNetworkError(error)
      ) {
        throw error;
      }

      await sleep(normalizedBaseDelayMs * 2 ** attempt);
    }
  }

  throw lastError ?? new Error('fetchWithRetry exhausted retries');
}

function resolveRetryDelayMs(response, baseDelayMs, attempt) {
  const retryAfter = response.headers?.get?.('retry-after');
  const retryAfterMs = parseRetryAfterMs(retryAfter);

  return retryAfterMs ?? baseDelayMs * 2 ** attempt;
}

function parseRetryAfterMs(value) {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryAt = Date.parse(value);
  if (!Number.isNaN(retryAt)) {
    return Math.max(0, retryAt - Date.now());
  }

  return null;
}

function toNonNegativeInteger(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function sleepFor(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function isTransientNetworkError(error) {
  const codes = new Set([
    'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN',
    'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET', 'UND_ERR_BODY_TIMEOUT',
  ]);
  const seen = new Set();
  for (let current = error; current && !seen.has(current); current = current.cause) {
    seen.add(current);
    if (codes.has(current.code)) return true;
  }
  return false;
}
