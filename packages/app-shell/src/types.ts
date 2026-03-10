import type { LucideIcon } from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type PrimaryNavItem = AppNavItem;

export type ToolNavItem = AppNavItem;

export type NavGroupConfig = {
  label: string;
  icon: LucideIcon;
  children: AppNavItem[];
};

export type LayoutUser = {
  email?: string | null;
  user_metadata?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

export type ShellBrandAsset = {
  src: string;
  width: number;
  height: number;
};

export type ShellBrand = {
  href: string;
  ariaLabel: string;
  alt: string;
  collapsedLogo: ShellBrandAsset;
  lightLogo: ShellBrandAsset;
  darkLogo: ShellBrandAsset;
};

export type ShellAccessLevel = "all" | "staff" | "admin";

export type ShellViewerContext = {
  isAdmin: boolean;
  isStaff: boolean;
  capabilities?: Record<string, boolean>;
};

export type ShellPathMatcher = {
  exact?: string[];
  prefixes?: string[];
  includes?: string[];
};

export type ShellToolbarSurface =
  | "dashboard"
  | "crm"
  | "crm-report"
  | "admin-users"
  | "admin-marketing"
  | "projects"
  | "project-detail"
  | "project-board"
  | "signature"
  | "insights-cms";

export type ShellToolbarRouteConfig = {
  surface: ShellToolbarSurface;
  match: ShellPathMatcher;
};

export type ShellToolsSectionBase = Omit<ShellNavSectionConfig, "items">;

export type ShellContextualAction = {
  label: string;
  icon: LucideIcon;
  action?: string;
};

export type ShellModulePlacement = "primary" | "tools" | "admin" | "hidden";

export type ShellNavItemConfig = AppNavItem & {
  visibility?: ShellAccessLevel;
  isVisible?: (viewer: ShellViewerContext) => boolean;
  activeMatch?: ShellPathMatcher;
};

export type ShellNavGroupConfig = {
  key: string;
  label: string;
  icon: LucideIcon;
  visibility?: ShellAccessLevel;
  isVisible?: (viewer: ShellViewerContext) => boolean;
  children: ShellNavItemConfig[];
};

export type ShellNavSectionConfig = {
  key: string;
  label: string;
  icon: LucideIcon;
  collapsedHref?: string;
  visibility?: ShellAccessLevel;
  isVisible?: (viewer: ShellViewerContext) => boolean;
  items: ShellNavItemConfig[];
};

export type ClientAppShellConfig = {
  brand: ShellBrand;
  primaryNav: ShellNavItemConfig[];
  adminNavItem?: ShellNavItemConfig | null;
  toolsSection: ShellNavSectionConfig;
  moduleGroups?: ShellNavGroupConfig[];
};

export type ShellModuleRegistration<TAction = never> = {
  key: string;
  placement?: ShellModulePlacement;
  navItems?: ShellNavItemConfig[];
  primaryNav?: ShellNavItemConfig[];
  adminNavItem?: ShellNavItemConfig | null;
  toolsItems?: ShellNavItemConfig[];
  moduleGroups?: ShellNavGroupConfig[];
  toolbarRoutes?: ShellToolbarRouteConfig[];
  toolbarActions?: Partial<Record<ShellToolbarSurface, TAction[]>>;
};

export type ClientAppShellRegistration<TAction = never> = {
  brand: ShellBrand;
  toolsSection: ShellToolsSectionBase;
  modules: ShellModuleRegistration<TAction>[];
};

export type BuiltClientAppShellRegistration<TAction = never> = {
  shellConfig: ClientAppShellConfig;
  toolbarRoutes: ShellToolbarRouteConfig[];
  toolbarActions: Partial<Record<ShellToolbarSurface, TAction[]>>;
};

export type ResolvedShellNavGroupConfig = Omit<ShellNavGroupConfig, "children"> & {
  children: ShellNavItemConfig[];
};

export type ResolvedClientAppShellConfig = Omit<ClientAppShellConfig, "primaryNav" | "toolsSection" | "moduleGroups"> & {
  primaryNav: ShellNavItemConfig[];
  toolsSection: ShellNavSectionConfig;
  moduleGroups: ResolvedShellNavGroupConfig[];
};

export type DesktopSidebarProps = {
  className?: string;
  brand: ShellBrand;
  collapsedToolsHref: string;
  isSidebarCollapsed: boolean;
  isToolActive: boolean;
  toolsExpanded: boolean;
  visiblePrimaryNav: PrimaryNavItem[];
  adminNavItem?: PrimaryNavItem | null;
  visibleToolNav: ToolNavItem[];
  crmNavGroup: NavGroupConfig;
  crmGroupExpanded: boolean;
  isCrmGroupActive: boolean;
  isNavItemActive: (href: string) => boolean;
  isToolLinkActive: (href: string) => boolean;
  isCrmChildActive: (href: string) => boolean;
  onToggleSidebar: () => void;
  onToggleTools: () => void;
  onToggleCrmGroup: () => void;
};

export type MobileNavProps = {
  className?: string;
  toolsExpanded: boolean;
  visiblePrimaryNav: PrimaryNavItem[];
  visibleToolNav: ToolNavItem[];
  isNavItemActive: (href: string) => boolean;
  isToolLinkActive: (href: string) => boolean;
  onToggleTools: () => void;
};

export type ThemeMenuProps = {
  onThemeChange: (theme: "light" | "dark" | "system") => void;
};

export type AccountMenuProps = {
  displayName: string | null;
  isStaff: boolean;
  onSignOut: () => Promise<void>;
  user: LayoutUser | null | undefined;
  userInitials: string;
};
