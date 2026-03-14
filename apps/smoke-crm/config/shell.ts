import { LayoutDashboard, Wrench } from "lucide-react";
import {
  buildClientAppShellRegistration,
  resolveClientAppShellConfig,
  type ClientAppShellRegistration,
  type ShellContextualAction,
  type ShellModuleRegistration,
} from "@brightweblabs/app-shell";
import { crmModuleRegistration } from "@brightweblabs/module-crm/registration";
import { starterBrandConfig } from "./brand";
import { getEnabledStarterModules } from "./modules";

const dashboardModuleRegistration: ShellModuleRegistration<ShellContextualAction> = {
  key: "dashboard",
  placement: "primary",
  navItems: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  toolbarRoutes: [{ surface: "dashboard", match: { exact: ["/dashboard"] } }],
};

function getStarterModuleRegistrations() {
  const enabled = new Set(getEnabledStarterModules().map((moduleConfig) => moduleConfig.key));
  const registrations: ShellModuleRegistration<ShellContextualAction>[] = [dashboardModuleRegistration];

  if (enabled.has("crm")) registrations.push(crmModuleRegistration);

  return registrations;
}

export function getStarterShellConfig() {
  const enabledModules = getEnabledStarterModules();
  const shellRegistration: ClientAppShellRegistration<ShellContextualAction> = {
    brand: {
      href: "/",
      ariaLabel: `${starterBrandConfig.companyName} public site`,
      alt: starterBrandConfig.companyName,
      collapsedLogo: {
        src: "/brand/logo-mark.svg",
        width: 48,
        height: 48,
      },
      lightLogo: {
        src: "/brand/logo-light.svg",
        width: 176,
        height: 44,
      },
      darkLogo: {
        src: "/brand/logo-dark.svg",
        width: 176,
        height: 44,
      },
    },
    toolsSection: {
      key: "tools",
      label: "Ferramentas",
      icon: Wrench,
      collapsedHref: enabledModules.find((moduleConfig) => moduleConfig.playgroundHref)?.playgroundHref || "/",
    },
    modules: getStarterModuleRegistrations(),
  };

  const builtRegistration = buildClientAppShellRegistration(shellRegistration);
  const shellPreview = resolveClientAppShellConfig(builtRegistration.shellConfig, {
    isAdmin: true,
    isStaff: true,
  });

  return {
    enabledModules,
    shellConfig: builtRegistration.shellConfig,
    shellPreview,
    toolbarRoutes: builtRegistration.toolbarRoutes,
  };
}
