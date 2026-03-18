type RouteHandler = (request: Request) => Response | Promise<Response>;

type ModuleWithHandler<THandlerName extends string> = Record<THandlerName, RouteHandler>;

export function createModuleRouteHandler<THandlerName extends string>(
  loadModule: () => Promise<ModuleWithHandler<THandlerName>>,
  handlerName: THandlerName,
): RouteHandler {
  return async function moduleRouteHandler(request: Request) {
    const module = await loadModule();
    return module[handlerName](request);
  };
}
