import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { getProjectsPortfolioPageData } from "./portfolio-page";
import { getProjectAccess, getProjectDashboard } from "./server";
import {
  ProjectBoardPage,
  ProjectDetailPage,
  ProjectsPage,
  ProjectTasksPage,
  type ProjectsNavigationConfig,
} from "./ui";

export type ProjectRouteProps = {
  projectId: string;
  navigation: ProjectsNavigationConfig;
};

export async function ProjectsRoutePage({ navigation }: { navigation: ProjectsNavigationConfig }) {
  await requireServerPageRoleAccess(["admin", "staff"]);
  const { organizationOptions, portfolioStats, result } = await getProjectsPortfolioPageData();
  const attentionSummary = {
    total: result.total,
    overdue: result.items.filter((project) => project.taskStats.overdue > 0).length,
    atRisk: result.items.filter((project) => project.health === "at_risk").length,
  };
  return (
    <ProjectsPage
      initialData={{ ...result, attentionSummary }}
      initialUpdatedAt={new Date().toISOString()}
      portfolioStats={portfolioStats}
      organizations={organizationOptions}
      navigation={navigation}
    />
  );
}

async function getInitialProject(projectId: string) {
  const { supabase, profileId, role } = await requireServerPageRoleAccess(["admin", "staff"]);
  const [initialData, access] = await Promise.all([
    getProjectDashboard(supabase, projectId),
    getProjectAccess(supabase, projectId, profileId, role),
  ]);
  return { initialData, access };
}

export async function ProjectDetailRoutePage({ projectId, navigation }: ProjectRouteProps) {
  const { initialData, access } = await getInitialProject(projectId);
  return <ProjectDetailPage initialData={initialData} projectRole={access.projectRole} viewerProfileId={access.viewerProfileId} permissions={access.permissions} navigation={navigation} />;
}

export async function ProjectBoardRoutePage({ projectId, navigation }: ProjectRouteProps) {
  const { initialData, access } = await getInitialProject(projectId);
  return <ProjectBoardPage initialData={initialData} projectRole={access.projectRole} viewerProfileId={access.viewerProfileId} permissions={access.permissions} navigation={navigation} />;
}

export async function ProjectTasksRoutePage({ projectId, navigation }: ProjectRouteProps) {
  const { initialData, access } = await getInitialProject(projectId);
  return <ProjectTasksPage initialData={initialData} projectRole={access.projectRole} viewerProfileId={access.viewerProfileId} permissions={access.permissions} navigation={navigation} />;
}

const PORTUGUESE_PROJECTS_NAVIGATION: ProjectsNavigationConfig = {
  listHref: "/projetos",
  detailHrefPattern: "/projetos/:projectId",
  boardHrefPattern: "/projetos/:projectId/tarefas",
};

export function ProjectsPortugueseRoutePage() {
  return <ProjectsRoutePage navigation={PORTUGUESE_PROJECTS_NAVIGATION} />;
}

export async function ProjectDetailPortugueseRoutePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectDetailRoutePage projectId={projectId} navigation={PORTUGUESE_PROJECTS_NAVIGATION} />;
}

export async function ProjectBoardPortugueseRoutePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectBoardRoutePage projectId={projectId} navigation={PORTUGUESE_PROJECTS_NAVIGATION} />;
}

export async function ProjectTasksPortugueseRoutePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectTasksRoutePage projectId={projectId} navigation={PORTUGUESE_PROJECTS_NAVIGATION} />;
}
