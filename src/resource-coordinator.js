export function createResourceCoordinator(loader) {
  const inFlight = new Map();
  let routeGeneration = 0;
  let selectionGeneration = 0;

  function load(path) {
    if (inFlight.has(path)) {
      return inFlight.get(path);
    }

    const request = Promise.resolve(loader(path)).finally(() => {
      if (inFlight.get(path) === request) {
        inFlight.delete(path);
      }
    });
    inFlight.set(path, request);
    return request;
  }

  function beginRoute() {
    routeGeneration += 1;
    return createToken('route');
  }

  function beginSelection() {
    selectionGeneration += 1;
    return createToken('selection');
  }

  function isCurrent(token) {
    if (!token || token.routeGeneration !== routeGeneration) {
      return false;
    }

    return token.scope === 'route' || token.selectionGeneration === selectionGeneration;
  }

  async function commit(token, request, { onError = () => {}, onSuccess = () => {} } = {}) {
    try {
      const value = await request;
      const applied = isCurrent(token);
      if (applied) {
        await onSuccess(value);
      }
      return { applied, status: 'fulfilled' };
    } catch (error) {
      const applied = isCurrent(token);
      if (applied) {
        await onError(error);
      }
      return { applied, status: 'rejected' };
    }
  }

  function createToken(scope) {
    return Object.freeze({
      scope,
      routeGeneration,
      selectionGeneration,
    });
  }

  return {
    load,
    beginRoute,
    beginSelection,
    isCurrent,
    commit,
  };
}
