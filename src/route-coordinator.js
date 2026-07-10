import { buildPagePath, routeFromPath } from './routes.js';

export function createRouteCoordinator({
  basePath = '/',
  getPathname,
  history,
  beforeHistoryChange = () => {},
  onRoute = () => {},
}) {
  function initialize() {
    return transition(routeFromPath(getPathname(), basePath), 'direct');
  }

  function navigate(route) {
    const path = buildPagePath(route, basePath);
    const resolvedRoute = routeFromPath(path, basePath);
    if (getPathname() !== path) {
      beforeHistoryChange(resolvedRoute, 'click');
      history.pushState({}, '', path);
    }
    return transition(resolvedRoute, 'click');
  }

  function handlePopState() {
    return transition(routeFromPath(getPathname(), basePath), 'popstate');
  }

  function transition(route, source) {
    onRoute(route, source);
    return route;
  }

  return {
    initialize,
    navigate,
    handlePopState,
  };
}
