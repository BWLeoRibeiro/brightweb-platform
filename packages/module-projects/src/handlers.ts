import { requireServerUserAccess } from "@brightweblabs/core-auth/server";
import {
  createProjectsActivityGetHandler,
  createProjectsAssignableProfilesGetHandler,
  createProjectsDashboardGetHandler,
  createProjectsDeleteHandler,
  createProjectsGetHandler,
  createProjectsLinksDeleteHandler,
  createProjectsLinksPatchHandler,
  createProjectsLinksPostHandler,
  createProjectsMembersPutHandler,
  createProjectsMilestonesDeleteHandler,
  createProjectsMilestonesPatchHandler,
  createProjectsMilestonesPostHandler,
  createProjectsOrganizationsGetHandler,
  createProjectsOrganizationsPostHandler,
  createProjectsPatchHandler,
  createProjectsPostHandler,
  createProjectsStatsGetHandler,
  createProjectsTasksDeleteHandler,
  createProjectsTasksPatchHandler,
  createProjectsTasksPostHandler,
} from "./http";
import {
  getProjectPortfolioStats,
  listProjects,
} from "./data";
import {
  createProject,
  createProjectLink,
  createProjectMilestone,
  createProjectOrganization,
  createProjectTask,
  deleteProject,
  deleteProjectLink,
  deleteProjectMilestone,
  deleteProjectTask,
  getProjectDashboard,
  listProjectActivity,
  listProjectAssignableProfiles,
  syncProjectMembers,
  updateProject,
  updateProjectLink,
  updateProjectMilestone,
  updateProjectTask,
} from "./server";

const projectsDependencies = {
  getAccess: requireServerUserAccess,
  listProjects,
  getPortfolioStats: getProjectPortfolioStats,
  getDashboard: getProjectDashboard,
  listActivity: listProjectActivity,
  listAssignableProfiles: listProjectAssignableProfiles,
  createOrganization: createProjectOrganization,
  createProject,
  updateProject,
  deleteProject,
  syncMembers: syncProjectMembers,
  createMilestone: createProjectMilestone,
  updateMilestone: updateProjectMilestone,
  deleteMilestone: deleteProjectMilestone,
  createTask: createProjectTask,
  updateTask: updateProjectTask,
  deleteTask: deleteProjectTask,
  createLink: createProjectLink,
  updateLink: updateProjectLink,
  deleteLink: deleteProjectLink,
};

export const handleProjectsGetRequest = createProjectsGetHandler(projectsDependencies);
export const handleProjectsStatsGetRequest = createProjectsStatsGetHandler(projectsDependencies);
export const handleProjectsDashboardGetRequest = createProjectsDashboardGetHandler(projectsDependencies);
export const handleProjectsActivityGetRequest = createProjectsActivityGetHandler(projectsDependencies);
export const handleProjectsOrganizationsGetRequest = createProjectsOrganizationsGetHandler(projectsDependencies);
export const handleProjectsAssignableProfilesGetRequest =
  createProjectsAssignableProfilesGetHandler(projectsDependencies);
export const handleProjectsOrganizationsPostRequest =
  createProjectsOrganizationsPostHandler(projectsDependencies);
export const handleProjectsPostRequest = createProjectsPostHandler(projectsDependencies);
export const handleProjectsPatchRequest = createProjectsPatchHandler(projectsDependencies);
export const handleProjectsDeleteRequest = createProjectsDeleteHandler(projectsDependencies);
export const handleProjectsMembersPutRequest = createProjectsMembersPutHandler(projectsDependencies);
export const handleProjectsMilestonesPostRequest =
  createProjectsMilestonesPostHandler(projectsDependencies);
export const handleProjectsMilestonesPatchRequest =
  createProjectsMilestonesPatchHandler(projectsDependencies);
export const handleProjectsMilestonesDeleteRequest =
  createProjectsMilestonesDeleteHandler(projectsDependencies);
export const handleProjectsTasksPostRequest = createProjectsTasksPostHandler(projectsDependencies);
export const handleProjectsTasksPatchRequest = createProjectsTasksPatchHandler(projectsDependencies);
export const handleProjectsTasksDeleteRequest = createProjectsTasksDeleteHandler(projectsDependencies);
export const handleProjectsLinksPostRequest = createProjectsLinksPostHandler(projectsDependencies);
export const handleProjectsLinksPatchRequest = createProjectsLinksPatchHandler(projectsDependencies);
export const handleProjectsLinksDeleteRequest = createProjectsLinksDeleteHandler(projectsDependencies);
