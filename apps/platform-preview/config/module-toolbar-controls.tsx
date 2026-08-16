"use client";

import type { ReactNode } from "react";
import { resolveShellToolbarSurface, type ShellToolbarRouteConfig, type ShellToolbarSurface } from "@brightweblabs/app-shell";
import { AdminToolbarControls } from "@brightweblabs/module-admin/ui";
import { CrmOrganizationsToolbarControls, CrmToolbarControls } from "@brightweblabs/module-crm/ui";
import { ProjectBoardToolbarControls, ProjectsToolbarControls } from "@brightweblabs/module-projects/ui";

type ModuleToolbarViewer = { isAdmin: boolean };

const toolbarControlBySurface: Partial<Record<ShellToolbarSurface, (viewer: ModuleToolbarViewer) => ReactNode>> = {
  "admin-users": () => <AdminToolbarControls />,
  crm: () => <CrmToolbarControls />,
  "crm-organizations": () => <CrmOrganizationsToolbarControls />,
  projects: (viewer) => <ProjectsToolbarControls viewer={viewer} />,
  "project-board": () => <ProjectBoardToolbarControls />,
};

export function getModuleToolbarControls(pathname: string, toolbarRoutes: ShellToolbarRouteConfig[], viewer: ModuleToolbarViewer) {
  const surface = resolveShellToolbarSurface(pathname, toolbarRoutes);
  return surface ? toolbarControlBySurface[surface]?.(viewer) ?? null : null;
}
