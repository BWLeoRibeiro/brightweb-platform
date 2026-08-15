"use client";

import type { ReactNode } from "react";
import { resolveShellToolbarSurface, type ShellToolbarRouteConfig, type ShellToolbarSurface } from "@brightweblabs/app-shell";
import { AdminToolbarControls } from "@brightweblabs/module-admin/ui";
import { CrmOrganizationsToolbarControls, CrmToolbarControls } from "@brightweblabs/module-crm/ui";
import { ProjectBoardToolbarControls, ProjectsToolbarControls } from "@brightweblabs/module-projects/ui";
import { MarketingToolbarControls } from "@brightweblabs/module-marketing/ui";

// MANAGED BY BRIGHTWEB — regenerated when modules are added, removed, or updated.
const toolbarControlBySurface: Partial<Record<ShellToolbarSurface, (canCreateProjects: boolean) => ReactNode>> = {
  "admin-users": () => <AdminToolbarControls />,
  crm: () => <CrmToolbarControls />,
  "crm-organizations": () => <CrmOrganizationsToolbarControls />,
  projects: (canCreateProjects) => <ProjectsToolbarControls canCreateProjects={canCreateProjects} />,
  "project-board": () => <ProjectBoardToolbarControls />,
  marketing: () => <MarketingToolbarControls />,
};

export function getModuleToolbarControls(pathname: string, toolbarRoutes: ShellToolbarRouteConfig[], canCreateProjects = false) {
  const surface = resolveShellToolbarSurface(pathname, toolbarRoutes);
  return surface ? toolbarControlBySurface[surface]?.(canCreateProjects) ?? null : null;
}
