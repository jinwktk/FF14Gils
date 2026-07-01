import { fileURLToPath } from 'node:url';

const DEFAULT_REPOSITORY = 'jinwktk/FF14Gils';
const DEFAULT_EVENT_TYPE = 'refresh-marketshare';
const DEFAULT_SOURCE = 'external-hourly-scheduler';

export function buildRepositoryDispatchRequest({
  env = process.env,
  token,
  now = new Date(),
} = {}) {
  const resolvedToken = token ?? resolveTokenFromEnv(env);
  const repository = env.FF14GILS_GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY;
  const eventType = env.FF14GILS_DISPATCH_EVENT_TYPE ?? DEFAULT_EVENT_TYPE;
  const source = env.FF14GILS_DISPATCH_SOURCE ?? DEFAULT_SOURCE;

  assertRepository(repository);
  assertNonEmpty(eventType, 'FF14GILS_DISPATCH_EVENT_TYPE');
  assertNonEmpty(source, 'FF14GILS_DISPATCH_SOURCE');

  return {
    eventType,
    repository,
    url: `https://api.github.com/repos/${repository}/dispatches`,
    options: {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${resolvedToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ff14gils-refresh-dispatch',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: {
          source,
          requested_at: now.toISOString(),
        },
      }),
    },
  };
}

export async function dispatchRepositoryRefresh({
  env = process.env,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const request = buildRepositoryDispatchRequest({ env, now });
  const response = await fetchImpl(request.url, request.options);

  if (!response.ok) {
    const details = await safeResponseText(response);
    const authorization = request.options.headers.Authorization;
    throw new Error(
      `GitHub repository_dispatch failed: HTTP ${response.status}${formatDetails(details, authorization)}`,
    );
  }

  return {
    eventType: request.eventType,
    repository: request.repository,
    status: response.status,
  };
}

function resolveTokenFromEnv(env) {
  const token = env.FF14GILS_GITHUB_TOKEN ?? env.GITHUB_TOKEN;
  assertNonEmpty(token, 'FF14GILS_GITHUB_TOKEN or GITHUB_TOKEN');
  return token;
}

function assertRepository(repository) {
  assertNonEmpty(repository, 'FF14GILS_GITHUB_REPOSITORY');

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('FF14GILS_GITHUB_REPOSITORY must be in owner/repo format.');
  }
}

function assertNonEmpty(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required.`);
  }
}

async function safeResponseText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function formatDetails(details, authorization) {
  if (!details) return '';
  return `: ${redactSecrets(details, authorization)}`;
}

function redactSecrets(text, authorization) {
  let redacted = text
    .replace(/gh[opsu]_[A-Za-z0-9_]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]');

  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (token) {
    redacted = redacted.split(token).join('[redacted]');
  }

  return redacted;
}

async function main() {
  const result = await dispatchRepositoryRefresh();
  console.log(
    `repository_dispatch sent: ${result.repository} ${result.eventType} HTTP ${result.status}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
