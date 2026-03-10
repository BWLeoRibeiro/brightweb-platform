import type {
  BuiltClientAppShellRegistration,
  ClientAppShellRegistration,
  ClientAppShellConfig,
  ResolvedClientAppShellConfig,
  ResolvedShellNavGroupConfig,
  ShellAccessLevel,
  ShellModulePlacement,
  ShellNavItemConfig,
  ShellPathMatcher,
  ShellToolbarRouteConfig,
  ShellToolbarSurface,
  ShellViewerContext,
} from "./types";

function canAccessLevel(level: ShellAccessLevel | undefined, viewer: ShellViewerContext) {
  if (level === "admin") {
    return viewer.isAdmin;
  }

  if (level === "staff") {
    return viewer.isStaff || viewer.isAdmin;
  }

  return true;
}

function isItemVisible(item: { visibility?: ShellAccessLevel; isVisible?: (viewer: ShellViewerContext) => boolean }, viewer: ShellViewerContext) {
  if (!canAccessLevel(item.visibility, viewer)) {
    return false;
  }

  if (item.isVisible) {
    return item.isVisible(viewer);
  }

  return true;
}

export function matchesShellPath(pathname: string, matcher?: ShellPathMatcher) {
  if (!matcher) {
    return false;
  }

  if (matcher.exact?.includes(pathname)) {
    return true;
  }

  if (matcher.prefixes?.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  if (matcher.includes?.some((fragment) => pathname.includes(fragment))) {
    return true;
  }

  return false;
}

export function isShellNavItemActive(pathname: string, item: Pick<ShellNavItemConfig, "href" | "activeMatch">) {
  if (matchesShellPath(pathname, item.activeMatch)) {
    return true;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function resolveClientAppShellConfig(
  config: ClientAppShellConfig,
  viewer: ShellViewerContext,
): ResolvedClientAppShellConfig {
  const primaryNav = config.primaryNav.filter((item) => isItemVisible(item, viewer));
  const adminNavItem =
    config.adminNavItem && isItemVisible(config.adminNavItem, viewer) ? config.adminNavItem : null;
  const toolItems = config.toolsSection.items.filter((item) => isItemVisible(item, viewer));
  const toolsSection = {
    ...config.toolsSection,
    items: toolItems,
    collapsedHref: config.toolsSection.collapsedHref ?? toolItems[0]?.href,
  };
  const moduleGroups = (config.moduleGroups ?? [])
    .filter((group) => isItemVisible(group, viewer))
    .map<ResolvedShellNavGroupConfig>((group) => ({
      ...group,
      children: group.children.filter((item) => isItemVisible(item, viewer)),
    }))
    .filter((group) => group.children.length > 0);

  return {
    ...config,
    adminNavItem,
    primaryNav,
    toolsSection,
    moduleGroups,
  };
}

export function buildClientAppShellRegistration<TAction = never>(
  registration: ClientAppShellRegistration<TAction>,
): BuiltClientAppShellRegistration<TAction> {
  const navItemsForPlacement = (placement: ShellModulePlacement) =>
    registration.modules.flatMap((module) => {
      if (module.placement === placement) {
        return module.navItems ?? [];
      }

      if (placement === "primary") {
        return module.primaryNav ?? [];
      }

      if (placement === "tools") {
        return module.toolsItems ?? [];
      }

      if (placement === "admin" && module.adminNavItem) {
        return [module.adminNavItem];
      }

      return [];
    });

  const primaryNav = navItemsForPlacement("primary");
  const adminNavItem = navItemsForPlacement("admin")[0] ?? null;
  const toolsItems = navItemsForPlacement("tools");
  const moduleGroups = registration.modules.flatMap((module) => module.moduleGroups ?? []);
  const toolbarRoutes = registration.modules.flatMap((module) => module.toolbarRoutes ?? []);
  const toolbarActions = registration.modules.reduce<Partial<Record<ShellToolbarSurface, TAction[]>>>((acc, module) => {
    const actions = module.toolbarActions ?? {};

    for (const [surface, items] of Object.entries(actions) as [ShellToolbarSurface, TAction[]][]) {
      if (!items?.length) {
        continue;
      }

      acc[surface] = [...(acc[surface] ?? []), ...items];
    }

    return acc;
  }, {});

  return {
    shellConfig: {
      brand: registration.brand,
      primaryNav,
      adminNavItem,
      toolsSection: {
        ...registration.toolsSection,
        items: toolsItems,
      },
      moduleGroups,
    },
    toolbarRoutes,
    toolbarActions,
  };
}

export function getShellNavGroup(
  config: Pick<ResolvedClientAppShellConfig, "moduleGroups">,
  key: string,
) {
  return config.moduleGroups.find((group) => group.key === key) ?? null;
}

export function getShellNavItem(
  items: ShellNavItemConfig[],
  href: string,
) {
  return items.find((item) => item.href === href) ?? null;
}

export function resolveShellToolbarSurface(
  pathname: string,
  routes: ShellToolbarRouteConfig[],
  fallback: ShellToolbarSurface = "dashboard",
) {
  return routes.find((route) => matchesShellPath(pathname, route.match))?.surface ?? fallback;
}
