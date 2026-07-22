"use client";

import { ArrowLeft, BriefcaseBusiness, Eye, KanbanSquare, Plus, RotateCcw } from "lucide-react";
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
      { label: "Portfólio", icon: ArrowLeft, action: "projects-back-to-portfolio" },
      { label: "Tarefas", icon: KanbanSquare, action: "projects-open-board" },
    ],
    "project-board": [
      { label: "Portfólio", icon: ArrowLeft, action: "projects-back-to-portfolio" },
      { label: "Visão geral", icon: Eye, action: "projects-open-detail" },
    ],
  },
}; }

export const projectsModuleRegistration = createProjectsModuleRegistration();
