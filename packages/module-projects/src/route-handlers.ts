import {
  handleClientProjectDetailGetRequest,
  handleClientProjectsGetRequest,
  handleProjectClientAccessGetRequest,
  handleProjectClientAccessPatchRequest,
  handleProjectOrganizationsPatchRequest,
  handleProjectsActivityGetRequest,
  handleProjectsAssignableProfilesGetRequest,
  handleProjectsDashboardGetRequest,
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
} from "./handlers";

type IdRouteContext = { params: Promise<{ id: string }> };
type ItemRouteContext = { params: Promise<{ id: string; itemId: string }> };

export const projectsGet = (request: Request) => handleProjectsGetRequest(request);
export const projectsPost = (request: Request) => handleProjectsPostRequest(request);
export const projectsStatsGet = (request: Request) => handleProjectsStatsGetRequest(request);
export const projectsSetupOptionsGet = (request: Request) => handleProjectsSetupOptionsGetRequest(request);
export const projectsOrganizationsGet = (request: Request) => handleProjectsOrganizationsGetRequest(request);
export const projectsOrganizationsPost = (request: Request) => handleProjectsOrganizationsPostRequest(request);
export const clientProjectsGet = (request: Request) => handleClientProjectsGetRequest(request);
export const clientProjectDetailGet = (request: Request, context: IdRouteContext) => handleClientProjectDetailGetRequest(request, context);
export const projectClientAccessGet = (request: Request, context: IdRouteContext) => handleProjectClientAccessGetRequest(request, context);
export const projectClientAccessPatch = (request: Request, context: IdRouteContext) => handleProjectClientAccessPatchRequest(request, context);
export const projectOrganizationsPatch = (request: Request, context: IdRouteContext) => handleProjectOrganizationsPatchRequest(request, context);
export const projectDashboardGet = (request: Request, context: IdRouteContext) => handleProjectsDashboardGetRequest(request, context);
export const projectPatch = (request: Request, context: IdRouteContext) => handleProjectsPatchRequest(request, context);
export const projectDelete = (request: Request, context: IdRouteContext) => handleProjectsDeleteRequest(request, context);
export const projectActivityGet = (request: Request, context: IdRouteContext) => handleProjectsActivityGetRequest(request, context);
export const projectMembersGet = (request: Request, context: IdRouteContext) => handleProjectsAssignableProfilesGetRequest(request, context);
export const projectMembersPut = (request: Request, context: IdRouteContext) => handleProjectsMembersPutRequest(request, context);
export const projectLinksPost = (request: Request, context: IdRouteContext) => handleProjectsLinksPostRequest(request, context);
export const projectLinkPatch = (request: Request, context: ItemRouteContext) => handleProjectsLinksPatchRequest(request, context);
export const projectLinkDelete = (request: Request, context: ItemRouteContext) => handleProjectsLinksDeleteRequest(request, context);
export const projectMilestonesPost = (request: Request, context: IdRouteContext) => handleProjectsMilestonesPostRequest(request, context);
export const projectMilestonePatch = (request: Request, context: ItemRouteContext) => handleProjectsMilestonesPatchRequest(request, context);
export const projectMilestoneDelete = (request: Request, context: ItemRouteContext) => handleProjectsMilestonesDeleteRequest(request, context);
export const projectTasksPost = (request: Request, context: IdRouteContext) => handleProjectsTasksPostRequest(request, context);
export const projectTaskPatch = (request: Request, context: ItemRouteContext) => handleProjectsTasksPatchRequest(request, context);
export const projectTaskDelete = (request: Request, context: ItemRouteContext) => handleProjectsTasksDeleteRequest(request, context);
