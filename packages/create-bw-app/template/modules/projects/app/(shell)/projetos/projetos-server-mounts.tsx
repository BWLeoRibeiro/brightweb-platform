import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import {
  getProjectDashboard,
  getProjectAccess,
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
  detailHrefPattern: "/projetos/:projectId",
  boardHrefPattern: "/projetos/:projectId/tarefas",
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
  const { supabase, profileId, role } = await requireServerPageAccess();
  const [initialData, access] = await Promise.all([
    getProjectDashboard(supabase, projectId),
    getProjectAccess(supabase, projectId, profileId, role),
  ]);
  return { initialData, access };
}

export async function ProjectDetailServerMount({ params }: { params: Promise<{ projectId: string }> }) {
  const { initialData, access } = await getInitialProject(params);
  return <ProjectDetailPageLiveMount initialData={initialData} projectRole={access.projectRole} permissions={access.permissions} navigation={navigation} />;
}

export async function ProjectBoardServerMount({ params }: { params: Promise<{ projectId: string }> }) {
  const { initialData, access } = await getInitialProject(params);
  return <ProjectBoardPageLiveMount initialData={initialData} projectRole={access.projectRole} permissions={access.permissions} navigation={navigation} />;
}

export async function ProjectTasksServerMount({ params }: { params: Promise<{ projectId: string }> }) {
  const { initialData, access } = await getInitialProject(params);
  return <ProjectTasksPageLiveMount initialData={initialData} projectRole={access.projectRole} permissions={access.permissions} navigation={navigation} />;
}
