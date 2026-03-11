export { adminModuleRegistration } from "./registration";
export { handleAdminUsersGetRequest, handleAdminUsersRoleChangeRequest } from "./handlers";
export {
  ADMIN_USERS_DEFAULT_PAGE_SIZE,
  ADMIN_USERS_MAX_PAGE_SIZE,
  getAdminUsersPageData,
  listAdminUsers,
  type AdminManagedRole,
  type AdminUserRow,
  type AdminUsersListResult,
  type AdminUsersPageData,
  type AdminUsersPagination,
} from "./users";
export { applyAdminRoleChanges, type AdminRoleChangeResult, type AdminRoleChangeSkipped, type AdminRoleChangeSummary } from "./roles";
export {
  ADMIN_EVENTS,
  dispatchAdminCustomEvent,
  dispatchAdminEvent,
  type AdminSetBulkRoleEventDetail,
  type AdminSetRoleFilterEventDetail,
  type AdminSetSearchEventDetail,
  type AdminStateEventDetail,
} from "./events";
export { AdminUsersClient } from "./users-client";
