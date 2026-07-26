import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import {
  getProjectDashboard,
  getProjectsPortfolioPageData,
} from "@brightweblabs/module-projects";
import {
  ProjectBoardPageLiveMount,
  ProjectDetailPageLiveMount,
  ProjectsPageLiveMount,
  ProjectTasksPageLiveMount,
} from "./projects-live-mounts";

const navigation = {
  listHref: "/projects",
  detailHref: (id: string) => `/projects/${id}`,
  boardHref: (id: string) => `/projects/${id}/tasks`,
};

export async function ProjectsServerMount() {
  const { organizationOptions, portfolioStats, result } = await getProjectsPortfolioPageData();
  const attentionSummary = {
    total: result.total,
    overdue: result.items.filter((project) => project.taskStats.overdue > 0).length,
    atRisk: result.items.filter((project) => project.health === "at_risk").length,
  };

  return (
    <ProjectsPageLiveMount
      initialData={{ ...result, attentionSummary }}
      initialUpdatedAt={new Date().toISOString()}
      portfolioStats={portfolioStats}
      organizations={organizationOptions}
      navigation={navigation}
    />
  );
}

async function getInitialProject(params: Promise<{ id: string }>) {
  const { id } = await params;
  const { supabase } = await requireServerPageAccess();
  return getProjectDashboard(supabase, id);
}

export async function ProjectDetailServerMount({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectDetailPageLiveMount initialData={await getInitialProject(params)} navigation={navigation} />;
}

export async function ProjectBoardServerMount({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectBoardPageLiveMount initialData={await getInitialProject(params)} navigation={navigation} />;
}

export async function ProjectTasksServerMount({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectTasksPageLiveMount initialData={await getInitialProject(params)} navigation={navigation} />;
}
