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
} from "./projetos-live-mounts";

const navigation = {
  listHref: "/projetos",
  detailHref: (id: string) => `/projetos/${id}`,
  boardHref: (id: string) => `/projetos/${id}/tarefas`,
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

async function getInitialProject(params: Promise<{ projectId: string }>) {
  const { projectId } = await params;
  const { supabase } = await requireServerPageAccess();
  return getProjectDashboard(supabase, projectId);
}

export async function ProjectDetailServerMount({ params }: { params: Promise<{ projectId: string }> }) {
  return <ProjectDetailPageLiveMount initialData={await getInitialProject(params)} navigation={navigation} />;
}

export async function ProjectBoardServerMount({ params }: { params: Promise<{ projectId: string }> }) {
  return <ProjectBoardPageLiveMount initialData={await getInitialProject(params)} navigation={navigation} />;
}

export async function ProjectTasksServerMount({ params }: { params: Promise<{ projectId: string }> }) {
  return <ProjectTasksPageLiveMount initialData={await getInitialProject(params)} navigation={navigation} />;
}
