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

export const starterModuleConfig: StarterModuleConfig[] = [
  {
    key: "core-auth",
    label: "Core Auth",
    description: "Login, reset-password, callback URLs, and shared auth validation utilities.",
    enabled: true,
    packageName: "@brightweblabs/core-auth",
    playgroundHref: "/playground/auth",
    placement: "core",
  },
  {
    key: "crm",
    label: "CRM",
    description: "Contacts, marketing audience, and CRM server/data layer.",
    enabled: true,
    packageName: "@brightweblabs/module-crm",
    playgroundHref: "/playground/crm",
    placement: "primary",
  },
  {
    key: "projects",
    label: "Projects",
    description: "Project portfolio, detail routes, and work-management server logic.",
    enabled: true,
    packageName: "@brightweblabs/module-projects",
    playgroundHref: "/playground/projects",
    placement: "primary",
  },
  {
    key: "admin",
    label: "Admin",
    description: "User role governance, admin tools, and access-control surfaces.",
    enabled: true,
    packageName: "@brightweblabs/module-admin",
    playgroundHref: "/playground/admin",
    placement: "admin",
  },
];

export function getEnabledStarterModules() {
  return starterModuleConfig.filter((moduleConfig) => moduleConfig.enabled);
}
