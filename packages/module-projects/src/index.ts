import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
export {
  ClientAccountPage,
  ClientProfilePage,
  ClientProjectDetailLoading,
  ClientPortalHomeLoading,
  ClientProjectDetailPage,
  ClientProjectDetailRoute,
  ClientProjectsListLoading,
  ClientProjectsListPage,
  ClientProjectsPreviewListPage,
  ClientProjectsPreview,
  ProjectListCard,
} from "./ui/client/index";
export {
  listAccountProjects,
  type AccountProjectsResult,
} from "./account-projects";
export {
  activityActorName,
  composeProjectMessage,
  ptProjectActivityDictionary,
  type ProjectActivityDictionary,
  type ProjectActivityMessageItem,
} from "./activity-messages";
export {
  PROJECT_HEALTH_STATES,
  PROJECT_STATUSES,
  type ListProjectsParams,
  type ProjectHealth,
  type ProjectListItem,
  type ProjectStatus,
  type ProjectsDueWindow,
  type ProjectsListResult,
  type ProjectsPortfolioPageData,
  type ProjectsPortfolioStats,
} from "./data";
export {
  MILESTONE_STATUSES,
  PROJECT_LINK_KIND,
  PROJECT_LINK_VISIBILITY,
  PROJECT_CLIENT_ACCESS_MODES,
  PROJECT_MILESTONE_VISIBILITIES,
  PROJECT_MEMBER_ROLES,
  PROJECT_MEMBER_ROLE_LABELS_PT,
  TASK_PRIORITIES,
  TASK_STATUSES,
  isMilestoneStatus,
  isProjectHealth,
  isProjectClientAccessMode,
  isProjectLinkKind,
  isProjectLinkVisibility,
  isProjectMemberRole,
  isProjectStatus,
  isProjectMilestoneVisibility,
  isTaskPriority,
  isTaskStatus,
  parsePositiveInt,
  type MilestoneStatus,
  type ProjectLinkKind,
  type ProjectLinkVisibility,
  type ProjectMemberRole,
  type ProjectClientAccessMode,
  type ProjectMilestoneVisibility,
  type TaskPriority,
  type TaskStatus,
} from "./contracts";
export {
  createProjectWithAccess,
  getClientProject,
  getProjectClientAccess,
  listClientOrganizations,
  listClientProjects,
  listProjectSetupOptions,
  updateProjectClientAccess,
  updateProjectOrganizations,
} from "./client-access";
export type {
  ClientOrganizationMembership,
  ClientProjectContact,
  ClientProjectDetail,
  ClientProjectDocument,
  ClientProjectListItem,
  ClientProjectMeta,
  ClientProjectOrganization,
  ClientProjectProgress,
  ClientProjectsResult,
  CreateProjectWithAccessInput,
  CreateProjectWithAccessResult,
  ProjectClientAccessConfiguration,
  ProjectClientAccessEligibleClient,
  ProjectClientAccessOrganization,
  ProjectSetupOptions,
  ProjectSetupStaffOption,
  UpdateProjectClientAccessInput,
} from "./client-contracts";
export {
  buildProjectsDashboardData,
  buildTasksDashboardData,
  getDashboardProjectAttentionReason,
  getDashboardTaskAttentionState,
  getProjectsDashboardData,
  getTasksDashboardData,
  rankDashboardAttentionTasks,
  rankDashboardAttentionProjects,
  type ProjectsDashboardSnapshot,
  type TasksDashboardOptions,
  type TasksDashboardSnapshot,
} from "./dashboard";
export {
  createProject,
  createProjectLink,
  createProjectMilestone,
  createProjectOrganization,
  createProjectTask,
  deleteProject,
  deleteProjectLink,
  deleteProjectMilestone,
  deleteProjectTask,
  getProjectPortfolioStats,
  getClientProjectHealth,
  getProjectDashboard,
  getProjectClientAccessSummary,
  getProjectAccess,
  isProjectsSchemaMissingError,
  listProjectActivity,
  queryProjectActivity,
  listProjects,
  listOrgAdminProjectsByProfile,
  listProjectAssignableProfiles,
  listProjectLinks,
  listProjectMilestones,
  listProjectTasks,
  resolveProjectMemberColors,
  syncProjectMembers,
  updateProject,
  updateProjectLink,
  updateProjectMilestone,
  updateProjectTask,
  type ProjectAccessRole,
} from "./server";
export {
  handleClientProjectDetailGetRequest,
  handleClientProjectsGetRequest,
  handleProjectClientAccessGetRequest,
  handleProjectClientAccessPatchRequest,
  handleProjectOrganizationsPatchRequest,
  handleProjectsActivityGetRequest,
  handleProjectsAssignableProfilesGetRequest,
  handleProjectsDashboardGetRequest,
  handleProjectsDashboardOverviewGetRequest,
  handleProjectsDeleteRequest,
  handleProjectsGetRequest,
  handleProjectsLinksDeleteRequest,
  handleProjectsLinksPatchRequest,
  handleProjectsLinksPostRequest,
  handleProjectsMembersPutRequest,
  handleProjectsMilestonesDeleteRequest,
  handleProjectsMilestonesPatchRequest,
  handleProjectsMilestonesPostRequest,
  handleProjectsOrganizationsGetRequest,
  handleProjectsOrganizationsPostRequest,
  handleProjectsPatchRequest,
  handleProjectsPostRequest,
  handleProjectsStatsGetRequest,
  handleProjectsSetupOptionsGetRequest,
  handleProjectsTasksDeleteRequest,
  handleProjectsTasksPatchRequest,
  handleProjectsTasksPostRequest,
  handleTasksDashboardGetRequest,
} from "./handlers";
export type {
  CreateProjectInput,
  CreateProjectLinkInput,
  CreateProjectMilestoneInput,
  CreateProjectOrganizationInput,
  CreateProjectTaskInput,
  ProjectActivityItem,
  ProjectActivityPage,
  ProjectAssignableProfile,
  ProjectClientAccessSummary,
  ProjectDashboardData,
  ProjectLink,
  ProjectMember,
  ProjectMemberColor,
  ProjectMemberInput,
  ProjectMilestone,
  ProjectTask,
  UpdateProjectInput,
  UpdateProjectLinkInput,
  UpdateProjectMilestoneInput,
  UpdateProjectTaskInput,
} from "./types";
import {
  getProjectPortfolioStats,
  isProjectsSchemaMissingError,
  listProjects,
} from "./server";
import {
  type ProjectsListResult,
  type ProjectsPortfolioPageData,
  type ProjectsPortfolioStats,
} from "./data";

export async function getProjectsPortfolioPageData(): Promise<ProjectsPortfolioPageData> {
  const { supabase } = await requireServerPageRoleAccess(["staff", "admin"]);
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(500);

  const organizationOptions = ((organizations ?? []) as { id: string; name: string }[]).map((organization) => ({
    id: organization.id,
    name: organization.name,
  }));

  let result: ProjectsListResult;
  let portfolioStats: ProjectsPortfolioStats;
  let schemaMissing = false;

  try {
    [portfolioStats, result] = await Promise.all([
      getProjectPortfolioStats(supabase),
      listProjects(supabase, { page: 1, pageSize: 9, dueWindow: "all", status: "all" }),
    ]);
  } catch (error) {
    if (isProjectsSchemaMissingError(error)) {
      schemaMissing = true;
      portfolioStats = { total: 0, planned: 0, active: 0, atRisk: 0, overdue: 0 };
      result = { items: [], total: 0, page: 1, pageSize: 9 };
    } else {
      throw error;
    }
  }

  return {
    organizationOptions,
    portfolioStats,
    result,
    schemaMissing,
  };
}
