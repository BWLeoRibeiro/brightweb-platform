"use client";

import { ArrowLeft, BriefcaseBusiness, KanbanSquare, Plus, RotateCcw } from "lucide-react";
import type { ShellContextualAction, ShellModuleRegistration } from "@brightweblabs/app-shell";

export function createProjectsModuleRegistration(baseHref = "/projetos"): ShellModuleRegistration<ShellContextualAction> { return {
  key: "projects",
  placement: "primary",
  navItems: [{ href: baseHref, label: "Projetos", icon: BriefcaseBusiness }],
  toolbarRoutes: [
    { surface: "project-board", match: { includes: ["/tarefas", "/quadro"] } },
    { surface: "project-detail", match: { prefixes: [`${baseHref}/`] } },
    { surface: "projects", match: { exact: [baseHref] } },
  ],
  toolbarActions: {
    projects: [
      { label: "Atualizar", icon: RotateCcw, action: "projects-refresh" },
      { label: "Novo", icon: Plus, action: "projects-new-menu" },
    ],
    "project-detail": [
      { label: "Projetos", icon: ArrowLeft, action: "projects-back-to-portfolio", placement: "back" },
      { label: "Ver tarefas", icon: KanbanSquare, action: "projects-open-board", placement: "contextual" },
    ],
    "project-board": [
      { label: "Projetos", icon: ArrowLeft, action: "projects-back-to-portfolio", placement: "back" },
    ],
  },
}; }

export const projectsModuleRegistration = createProjectsModuleRegistration();
export const projectsPreviewModuleRegistration = createProjectsModuleRegistration("/projects");
