"use client";

import type { ReactNode } from "react";
import { resolveShellToolbarSurface, type ShellToolbarRouteConfig, type ShellToolbarSurface } from "@brightweblabs/app-shell";
import { AdminToolbarControls } from "@brightweblabs/module-admin/ui";
import { CrmOrganizationsToolbarControls, CrmToolbarControls } from "@brightweblabs/module-crm/ui";
import { ProjectBoardToolbarControls, ProjectsToolbarControls } from "@brightweblabs/module-projects/ui";
import { MarketingToolbarControls } from "@brightweblabs/module-marketing/ui";

// MANAGED BY BRIGHTWEB — regenerated when modules are added, removed, or updated.
type ModuleToolbarViewer = { isAdmin: boolean };

const toolbarControlBySurface: Partial<Record<ShellToolbarSurface, (viewer: ModuleToolbarViewer) => ReactNode>> = {
  "admin-users": () => <AdminToolbarControls />,
  crm: () => <CrmToolbarControls />,
  "crm-organizations": () => <CrmOrganizationsToolbarControls />,
  projects: (viewer) => <ProjectsToolbarControls viewer={viewer} />,
  "project-board": () => <ProjectBoardToolbarControls />,
  marketing: () => <MarketingToolbarControls />,
};

export function getModuleToolbarControls(pathname: string, toolbarRoutes: ShellToolbarRouteConfig[], viewer: ModuleToolbarViewer) {
  const surface = resolveShellToolbarSurface(pathname, toolbarRoutes);
  return surface ? toolbarControlBySurface[surface]?.(viewer) ?? null : null;
}
