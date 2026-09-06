"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DashboardAssignedTask, DashboardProjectAttentionItem, DashboardProjectComponents, DashboardTaskAttentionState } from "./types";
import { defaultDashboardDictionary, type DashboardDictionary } from "./dictionary";

const ProjectComponentsContext = createContext<DashboardProjectComponents | null>(null);

export const DashboardDictionaryContext = createContext<DashboardDictionary>(defaultDashboardDictionary);

function useProjectComponents() { return useContext(ProjectComponentsContext); }

export function useDashboardDictionary() { return useContext(DashboardDictionaryContext); }

export function useProjectBaseHref() { return useProjectComponents()?.projectBaseHref ?? "/projects"; }

export function useTasksBaseHref() { const value = useProjectComponents(); return value?.tasksBaseHref ?? value?.projectBaseHref ?? "/projects"; }

export function buildDashboardProjectHref(baseHref: string, projectId?: string) { return projectId ? `${baseHref}/${encodeURIComponent(projectId)}` : baseHref; }

export function ProjectAttentionCard({ project, rank }: { project: DashboardProjectAttentionItem; rank: number }) { const value = useProjectComponents(); const href = buildDashboardProjectHref(value?.projectBaseHref ?? "/projects", project.id); return value?.ProjectAttentionCard ? <value.ProjectAttentionCard project={project} rank={rank} href={href} /> : value ? <value.ProjectSummaryCard project={project} /> : null; }

export function DashboardTaskListRow(props: { task: DashboardAssignedTask; href: string; attentionState?: DashboardTaskAttentionState; attentionLabel?: string }) { const value = useProjectComponents(); return value ? <value.DashboardTaskRow {...props} /> : null; }

export function DashboardProjectComponentsProvider({ value, children }: { value: DashboardProjectComponents | null; children: ReactNode }) {
  return <ProjectComponentsContext.Provider value={value}>{children}</ProjectComponentsContext.Provider>;
}
