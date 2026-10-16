"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { DashboardDataClient, DashboardInitialData, DashboardSurfaceContribution } from "./types";
import { useDashboardData } from "./use-dashboard-data";
import { defaultDashboardDictionary, type DashboardDictionary } from "./dictionary";
import { TabKey } from "./dashboard-formatters";
import { buildTasks, TasksView } from "./tasks-view";
import { buildMilestones, ProjectsView } from "./projects-view";
import { DashboardDictionaryContext, DashboardProjectComponentsProvider } from "./dashboard-context";
import { WelcomeHeader, TabsRow } from "./dashboard-header";
import { OverviewView } from "./overview-view";
import { ClientsView } from "./clients-view";

export type AppDashboardProps = {
  client: DashboardDataClient;
  contributions: DashboardSurfaceContribution[];
  initialData?: DashboardInitialData;
  viewerFirstName?: string | null;
  dictionary?: DashboardDictionary;
  onNotify?: (message: string) => void;
};

export function AppDashboard({ client, contributions, initialData, viewerFirstName, dictionary = defaultDashboardDictionary, onNotify }: AppDashboardProps) {
  const sections = useMemo(() => Array.from(new Set(contributions.flatMap((contribution) => contribution.sections))), [contributions]);
  const projectComponents = contributions.find((contribution) => contribution.projectComponents)?.projectComponents ?? null;
  const projectBaseHref = projectComponents?.projectBaseHref ?? "/projects";
  const [tab, setTab] = useState<TabKey>("overview");
  const data = useDashboardData({ client, initialData, sections, messages: dictionary.data, onNotify });

  const taskRows = useMemo(() => buildTasks(data.tasks, projectBaseHref), [data.tasks, projectBaseHref]);
  const milestones = useMemo(() => buildMilestones(data.projects), [data.projects]);

  const urgentCount =
    (data.tasks?.kpis.overdue ?? 0) + (data.tasks?.kpis.blocked ?? 0) + (data.projects?.kpis.projectsAttention ?? 0);

  return (
    <DashboardDictionaryContext.Provider value={dictionary}>
    <DashboardProjectComponentsProvider value={projectComponents}>
    <div
      className="dashboard-root min-h-0"
      style={
        {
          ["--muted-foreground" as string]: "var(--dashboard-local-muted-foreground)",
          ["--border" as string]: "var(--dashboard-local-border)",
          ["--muted" as string]: "var(--dashboard-local-muted)",
        } as CSSProperties
      }
    >
      <div className="mx-auto flex w-full max-w-[1480px] flex-col pb-6 pt-0 md:pb-8">
        <WelcomeHeader
          name={viewerFirstName ?? ""}
          urgentCount={urgentCount}
          unownedProjects={data.projects?.kpis.projectsWithoutOwner ?? 0}
          errors={sections.flatMap((section) => data.errors[section] ? [data.errors[section]] : [])}
          activeProjects={data.projects?.kpis.projectsActive ?? 0}
          overdueProjects={data.projects?.kpis.projectsOverdue ?? 0}
          newLeads={data.crm?.kpis.crmNewLast7Days ?? 0}
        />
        <div className="mt-6">
          <TabsRow
            value={tab}
            sections={sections}
            onChange={(nextTab) => {
              setTab(nextTab);
              if (nextTab === "tasks") data.ensureTasks();
            }}
          />
        </div>

        <div className="mt-3">
          {tab === "overview" && (
            <OverviewView data={data} milestones={milestones} sections={sections} onViewAllTasks={() => setTab("tasks")} />
          )}
          {tab === "projects" && sections.includes("projects") ? <ProjectsView projects={data.projects} isLoading={data.isProjectsLoading} /> : null}
          {tab === "clients" && sections.includes("crm") ? <ClientsView crm={data.crm} isLoading={data.isCrmLoading} /> : null}
          {tab === "tasks" && sections.includes("tasks") ? (
            <TasksView
              rows={taskRows}
              tasks={data.tasks}
              isLoading={data.isTasksLoading}
              isLoadingMore={data.isTasksLoadingMore}
              onLoadMore={data.loadMoreTasks}
            />
          ) : null}
        </div>
      </div>
    </div>
    </DashboardProjectComponentsProvider>
    </DashboardDictionaryContext.Provider>
  );
}

export const DashboardClient = AppDashboard;

export { buildDashboardProjectHref, DashboardProjectComponentsProvider } from "./dashboard-context";
export { buildUpcomingMilestoneDays } from "./dashboard-formatters";
export { buildTaskQuickCreateHref, buildUpcomingTaskDays, getAttentionPreviewCapacity } from "./tasks-view";
export { buildProjectQuickCreateHref, ProjectQuickCreateAction, ProjectsView } from "./projects-view";
export { ClientsView } from "./clients-view";
export default AppDashboard;
