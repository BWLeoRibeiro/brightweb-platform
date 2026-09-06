"use client";

import type { DashboardSection } from "./types";
import { type DashboardState } from "./use-dashboard-data";
import { Milestone, MilestonesPanel } from "./projects-view";
import { ProjectsKpiCard, CrmKpiCard } from "./dashboard-kpis";
import { AttentionTasksCard } from "./tasks-view";

export function OverviewView({
  data,
  milestones,
  sections,
  onViewAllTasks,
}: {
  data: DashboardState;
  milestones: Milestone[];
  sections: DashboardSection[];
  onViewAllTasks: () => void;
}) {
  const overviewMilestones = milestones.slice(0, 5);

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-[auto_minmax(0,1fr)] lg:[grid-auto-flow:dense]">
      {sections.includes("projects") ? <ProjectsKpiCard projects={data.projects} isLoading={data.isProjectsLoading} /> : null}
      {sections.includes("crm") ? <CrmKpiCard crm={data.crm} isLoading={data.isCrmLoading} /> : null}
      {sections.includes("tasks") ? <AttentionTasksCard tasks={data.tasks} isLoading={data.tasks === null && data.isTasksLoading} onViewAll={onViewAllTasks} /> : null}
      {sections.includes("projects") ? <MilestonesPanel
        items={overviewMilestones}
        isLoading={data.isProjectsLoading && milestones.length === 0}
        className="lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:h-full"
      /> : null}
    </section>
  );
}
