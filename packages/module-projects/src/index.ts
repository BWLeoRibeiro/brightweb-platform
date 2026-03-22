import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
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
  PROJECT_MEMBER_ROLES,
  PROJECT_MEMBER_ROLE_LABELS_PT,
  TASK_PRIORITIES,
  TASK_STATUSES,
  isMilestoneStatus,
  isProjectHealth,
  isProjectLinkKind,
  isProjectLinkVisibility,
  isProjectMemberRole,
  isProjectStatus,
  isTaskPriority,
  isTaskStatus,
  parsePositiveInt,
  type MilestoneStatus,
  type ProjectLinkKind,
  type ProjectLinkVisibility,
  type ProjectMemberRole,
  type TaskPriority,
  type TaskStatus,
} from "./contracts";
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
  isProjectsSchemaMissingError,
  listProjects,
  listOrgAdminProjectsByProfile,
  listProjectAssignableProfiles,
  listProjectLinks,
  listProjectMilestones,
  listProjectTasks,
  syncProjectMembers,
  updateProject,
  updateProjectLink,
  updateProjectMilestone,
  updateProjectTask,
} from "./server";
export type {
  CreateProjectInput,
  CreateProjectLinkInput,
  CreateProjectMilestoneInput,
  CreateProjectOrganizationInput,
  CreateProjectTaskInput,
  ProjectActivityItem,
  ProjectAssignableProfile,
  ProjectDashboardData,
  ProjectLink,
  ProjectMember,
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
  const { supabase } = await requireServerPageAccess();
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
      listProjects(supabase, { page: 1, pageSize: 9, dueWindow: "all" }),
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
