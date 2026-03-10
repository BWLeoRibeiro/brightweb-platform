"use client";

import { ArrowLeft, BriefcaseBusiness, Eye, KanbanSquare, Plus, RotateCcw } from "lucide-react";
import type { ShellContextualAction, ShellModuleRegistration } from "@brightweb/app-shell";

export const projectsModuleRegistration: ShellModuleRegistration<ShellContextualAction> = {
  key: "projects",
  placement: "primary",
  navItems: [{ href: "/projetos", label: "Projetos", icon: BriefcaseBusiness }],
  toolbarRoutes: [
    { surface: "project-board", match: { prefixes: ["/projetos/"], includes: ["/tarefas", "/quadro"] } },
    { surface: "project-detail", match: { prefixes: ["/projetos/"] } },
    { surface: "projects", match: { exact: ["/projetos"] } },
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
};
