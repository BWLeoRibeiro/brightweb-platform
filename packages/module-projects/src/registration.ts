"use client";

import { ArrowLeft, BriefcaseBusiness, KanbanSquare, Plus, RotateCcw } from "lucide-react";
import type { ShellContextualAction, ShellModuleRegistration } from "@brightweblabs/app-shell";
import { ProjectSummaryCard } from "./ui/shared/project-summary-card";
import { ProjectSummaryCardSkeleton } from "./ui/shared/project-summary-card-skeleton";
import { TaskDueMeta, TaskPriorityTag, TaskStatusTag } from "./ui/shared/task-tags";
import { DashboardTaskRow } from "./ui/shared/dashboard-task-row";
import { DashboardProjectAttentionCard } from "./ui/shared/dashboard-project-attention-card";

export function createProjectsModuleRegistration(baseHref = "/projetos"): ShellModuleRegistration<ShellContextualAction> { return {
  key: "projects",
  placement: "primary",
  navItems: [
    { href: baseHref, label: "Projetos", icon: BriefcaseBusiness, visibility: "staff" },
    {
      href: "/account/projetos",
      label: "Os meus projetos",
      icon: BriefcaseBusiness,
      isVisible: (viewer) => !viewer.isStaff && !viewer.isAdmin,
    },
  ],
  toolbarRoutes: [
    { surface: "project-board", match: { includes: ["/tarefas", "/tasks", "/quadro"] } },
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
  dashboardContribution: {
    key: "projects",
    sections: ["projects", "tasks"],
    projectComponents: { projectBaseHref: baseHref, ProjectSummaryCard, ProjectSummaryCardSkeleton, ProjectAttentionCard: DashboardProjectAttentionCard, TaskDueMeta, TaskPriorityTag, TaskStatusTag, DashboardTaskRow },
  },
}; }

export const projectsModuleRegistration = createProjectsModuleRegistration();
export const projectsPreviewModuleRegistration = createProjectsModuleRegistration("/projects");
