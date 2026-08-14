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
} from "@brightweblabs/module-projects";

type IdRouteContext = { params: Promise<{ id: string }> };
type ItemRouteContext = { params: Promise<{ id: string; itemId: string }> };

export function projectsGet(request: Request) {
  return handleProjectsGetRequest(request);
}
export function clientProjectsGet(request: Request) {
  return handleClientProjectsGetRequest(request);
}
export function clientProjectDetailGet(request: Request, context: IdRouteContext) {
  return handleClientProjectDetailGetRequest(request, context);
}
export function projectClientAccessGet(request: Request, context: IdRouteContext) {
  return handleProjectClientAccessGetRequest(request, context);
}
export function projectClientAccessPatch(request: Request, context: IdRouteContext) {
  return handleProjectClientAccessPatchRequest(request, context);
}
export function projectOrganizationsPatch(request: Request, context: IdRouteContext) {
  return handleProjectOrganizationsPatchRequest(request, context);
}
export function projectsSetupOptionsGet(request: Request) {
  return handleProjectsSetupOptionsGetRequest(request);
}
export function projectsPost(request: Request) {
  return handleProjectsPostRequest(request);
}
export function projectsStatsGet(request: Request) {
  return handleProjectsStatsGetRequest(request);
}
export function projectsOrganizationsGet(request: Request) {
  return handleProjectsOrganizationsGetRequest(request);
}
export function projectsOrganizationsPost(request: Request) {
  return handleProjectsOrganizationsPostRequest(request);
}
export function projectDashboardGet(request: Request, context: IdRouteContext) {
  return handleProjectsDashboardGetRequest(request, context);
}
export function projectPatch(request: Request, context: IdRouteContext) {
  return handleProjectsPatchRequest(request, context);
}
export function projectDelete(request: Request, context: IdRouteContext) {
  return handleProjectsDeleteRequest(request, context);
}
export function projectActivityGet(request: Request, context: IdRouteContext) {
  return handleProjectsActivityGetRequest(request, context);
}
export function projectMembersGet(request: Request, context: IdRouteContext) {
  return handleProjectsAssignableProfilesGetRequest(request, context);
}
export function projectMembersPut(request: Request, context: IdRouteContext) {
  return handleProjectsMembersPutRequest(request, context);
}
export function projectLinksPost(request: Request, context: IdRouteContext) {
  return handleProjectsLinksPostRequest(request, context);
}
export function projectLinkPatch(request: Request, context: ItemRouteContext) {
  return handleProjectsLinksPatchRequest(request, context);
}
export function projectLinkDelete(request: Request, context: ItemRouteContext) {
  return handleProjectsLinksDeleteRequest(request, context);
}
export function projectMilestonesPost(request: Request, context: IdRouteContext) {
  return handleProjectsMilestonesPostRequest(request, context);
}
export function projectMilestonePatch(request: Request, context: ItemRouteContext) {
  return handleProjectsMilestonesPatchRequest(request, context);
}
export function projectMilestoneDelete(request: Request, context: ItemRouteContext) {
  return handleProjectsMilestonesDeleteRequest(request, context);
}
export function projectTasksPost(request: Request, context: IdRouteContext) {
  return handleProjectsTasksPostRequest(request, context);
}
export function projectTaskPatch(request: Request, context: ItemRouteContext) {
  return handleProjectsTasksPatchRequest(request, context);
}
export function projectTaskDelete(request: Request, context: ItemRouteContext) {
  return handleProjectsTasksDeleteRequest(request, context);
}
