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
  ShellModuleRegistration,
  ShellRegistrationOverrides,
  ShellToolbarRouteConfig,
  ShellToolbarSurface,
  ShellViewerContext,
} from "./types";

type ShellPathMatchScore = {
  kind: number;
  matchedLength: number;
  segments: number;
  staticLength: number;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createShellPathPattern(value: string, mode: "exact" | "prefix" | "includes") {
  const pattern = value
    .split(/(\[[^/\]]+\])/g)
    .map((part) => (/^\[[^/\]]+\]$/.test(part) ? "[^/]+" : escapeRegExp(part)))
    .join("");

  if (mode === "exact") return new RegExp(`^${pattern}$`);
  if (mode === "prefix") return new RegExp(`^${pattern}`);
  return new RegExp(pattern);
}

function getPatternSpecificity(value: string) {
  return {
    segments: value.split("/").filter(Boolean).length,
    staticLength: value.replace(/\[[^/\]]+\]/g, "").length,
  };
}

function compareShellPathMatchScores(left: ShellPathMatchScore, right: ShellPathMatchScore) {
  return left.kind - right.kind
    || left.matchedLength - right.matchedLength
    || left.segments - right.segments
    || left.staticLength - right.staticLength;
}

function getShellPathMatchScore(pathname: string, matcher?: ShellPathMatcher): ShellPathMatchScore | null {
  if (!matcher) return null;

  let bestScore: ShellPathMatchScore | null = null;
  const candidates = [
    { values: matcher.exact, mode: "exact" as const, kind: 2 },
    { values: matcher.prefixes, mode: "prefix" as const, kind: 1 },
    { values: matcher.includes, mode: "includes" as const, kind: 1 },
  ];

  for (const candidate of candidates) {
    for (const value of candidate.values ?? []) {
      const match = createShellPathPattern(value, candidate.mode).exec(pathname);
      if (!match) continue;

      const score = {
        kind: candidate.kind,
        matchedLength: match.index + match[0].length,
        ...getPatternSpecificity(value),
      };
      if (!bestScore || compareShellPathMatchScores(score, bestScore) > 0) {
        bestScore = score;
      }
    }
  }

  return bestScore;
}

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
  return getShellPathMatchScore(pathname, matcher) !== null;
}

function cloneShellPathMatcher(matcher: ShellPathMatcher | undefined) {
  if (!matcher) return matcher;
  return {
    ...matcher,
    exact: matcher.exact ? [...matcher.exact] : undefined,
    prefixes: matcher.prefixes ? [...matcher.prefixes] : undefined,
    includes: matcher.includes ? [...matcher.includes] : undefined,
  };
}

function cloneShellNavItem(item: ShellNavItemConfig) {
  return { ...item, activeMatch: cloneShellPathMatcher(item.activeMatch) };
}

function cloneShellModuleRegistration<TAction>(registration: ShellModuleRegistration<TAction>) {
  const cloneItems = (items: ShellNavItemConfig[] | undefined) => items?.map(cloneShellNavItem);
  const toolbarActions = registration.toolbarActions
    ? Object.fromEntries(Object.entries(registration.toolbarActions).map(([surface, actions]) => [
        surface,
        actions ? [...actions] : actions,
      ])) as ShellModuleRegistration<TAction>["toolbarActions"]
    : undefined;

  return {
    ...registration,
    navItems: cloneItems(registration.navItems),
    primaryNav: cloneItems(registration.primaryNav),
    adminNavItem: registration.adminNavItem ? cloneShellNavItem(registration.adminNavItem) : registration.adminNavItem,
    toolsItems: cloneItems(registration.toolsItems),
    moduleGroups: registration.moduleGroups?.map((group) => ({
      ...group,
      children: group.children.map(cloneShellNavItem),
    })),
    toolbarRoutes: registration.toolbarRoutes?.map((route) => ({
      ...route,
      match: cloneShellPathMatcher(route.match) ?? route.match,
    })),
    toolbarActions,
    dashboardContribution: registration.dashboardContribution ? {
      ...registration.dashboardContribution,
      sections: [...registration.dashboardContribution.sections],
      projectComponents: registration.dashboardContribution.projectComponents
        ? { ...registration.dashboardContribution.projectComponents }
        : undefined,
    } : undefined,
  };
}

export function applyShellRegistrationOverrides<TAction = never>(
  registrations: ShellModuleRegistration<TAction>[],
  overrides: ShellRegistrationOverrides,
): ShellModuleRegistration<TAction>[] {
  const knownKeys = registrations.map((registration) => registration.key);
  const knownKeySet = new Set(knownKeys);
  const unknownKeys = Object.keys(overrides).filter((key) => !knownKeySet.has(key));

  if (unknownKeys.length > 0) {
    console.warn(
      `Unknown shell registration override keys: ${unknownKeys.join(", ")}. Known keys: ${knownKeys.join(", ") || "(none)"}.`,
    );
  }

  return registrations.map((registration) => {
    const clonedRegistration = cloneShellModuleRegistration(registration);
    const override = overrides[registration.key];
    if (!override) return clonedRegistration;

    return {
      ...(override(clonedRegistration as ShellModuleRegistration) as ShellModuleRegistration<TAction>),
    };
  });
}

function overrideShellPathMatcherHref(matcher: ShellPathMatcher | undefined, fromHref: string, toHref: string) {
  if (!matcher) return matcher;

  const rewrite = (values: string[] | undefined) => values?.map((value) => value === fromHref ? toHref : value);
  return {
    ...matcher,
    exact: rewrite(matcher.exact),
    prefixes: rewrite(matcher.prefixes),
    includes: rewrite(matcher.includes),
  };
}

function overrideShellNavItemHref<T extends ShellNavItemConfig>(item: T, fromHref: string, toHref: string): T {
  return {
    ...item,
    href: item.href === fromHref ? toHref : item.href,
    activeMatch: overrideShellPathMatcherHref(item.activeMatch, fromHref, toHref),
  };
}

export function overrideNavHref<TAction = never>(
  registration: ShellModuleRegistration<TAction>,
  fromHref: string,
  toHref: string,
): ShellModuleRegistration<TAction> {
  const rewriteItems = (items: ShellNavItemConfig[] | undefined) =>
    items?.map((item) => overrideShellNavItemHref(item, fromHref, toHref));

  return {
    ...registration,
    navItems: rewriteItems(registration.navItems),
    primaryNav: rewriteItems(registration.primaryNav),
    adminNavItem: registration.adminNavItem
      ? overrideShellNavItemHref(registration.adminNavItem, fromHref, toHref)
      : registration.adminNavItem,
    toolsItems: rewriteItems(registration.toolsItems),
    moduleGroups: registration.moduleGroups?.map((group) => ({
      ...group,
      children: rewriteItems(group.children) ?? [],
    })),
    toolbarRoutes: registration.toolbarRoutes?.map((route) => ({
      ...route,
      match: overrideShellPathMatcherHref(route.match, fromHref, toHref) ?? route.match,
    })),
  };
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
  const dashboardContributions = registration.modules.flatMap((module) => module.dashboardContribution ? [module.dashboardContribution] : []);

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
    dashboardContributions,
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
  let bestRoute: ShellToolbarRouteConfig | undefined;
  let bestScore: ShellPathMatchScore | null = null;

  for (const route of routes) {
    const score = getShellPathMatchScore(pathname, route.match);
    if (score && (!bestScore || compareShellPathMatchScores(score, bestScore) > 0)) {
      bestRoute = route;
      bestScore = score;
    }
  }

  return bestRoute?.surface ?? fallback;
}
