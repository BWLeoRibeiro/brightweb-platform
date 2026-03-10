export type StarterModuleKey = "core-auth" | "crm" | "projects" | "admin";

export type StarterModuleConfig = {
  key: StarterModuleKey;
  label: string;
  description: string;
  enabled: boolean;
  packageName: string;
  playgroundHref?: string;
  placement: "core" | "primary" | "admin";
};

function envFlag(value: string | undefined, defaultValue: boolean) {
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

export const starterModuleConfig: StarterModuleConfig[] = [
  {
    key: "core-auth",
    label: "Core Auth",
    description: "Login, reset-password, callback URLs, and shared auth validation utilities.",
    enabled: true,
    packageName: "@brightweb/core-auth",
    playgroundHref: "/playground/auth",
    placement: "core",
  },
  {
    key: "crm",
    label: "CRM",
    description: "Contacts, marketing audience, and CRM server/data layer.",
    enabled: envFlag(process.env.NEXT_PUBLIC_ENABLE_CRM, true),
    packageName: "@brightweb/module-crm",
    playgroundHref: "/playground/crm",
    placement: "primary",
  },
  {
    key: "projects",
    label: "Projects",
    description: "Project portfolio, detail routes, and work-management server logic.",
    enabled: envFlag(process.env.NEXT_PUBLIC_ENABLE_PROJECTS, true),
    packageName: "@brightweb/module-projects",
    playgroundHref: "/playground/projects",
    placement: "primary",
  },
  {
    key: "admin",
    label: "Admin",
    description: "User role governance, admin tools, and access-control surfaces.",
    enabled: envFlag(process.env.NEXT_PUBLIC_ENABLE_ADMIN, true),
    packageName: "@brightweb/module-admin",
    playgroundHref: "/playground/admin",
    placement: "admin",
  },
];

export function getEnabledStarterModules() {
  return starterModuleConfig.filter((moduleConfig) => moduleConfig.enabled);
}
