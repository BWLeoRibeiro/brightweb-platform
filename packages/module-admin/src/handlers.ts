import { requireServerRoleAccess } from "@brightweblabs/core-auth/server";
import { createAdminUsersGetHandler, createAdminUsersRoleChangeHandler } from "./http.ts";
import { applyAdminRoleChanges } from "./roles.ts";
import { listAdminUsers } from "./users-data.ts";

export const handleAdminUsersGetRequest = createAdminUsersGetHandler({
  getAccess: () => requireServerRoleAccess("admin"),
  listUsers: listAdminUsers,
  applyRoleChanges: applyAdminRoleChanges,
});

export const handleAdminUsersRoleChangeRequest = createAdminUsersRoleChangeHandler({
  getAccess: () => requireServerRoleAccess("admin"),
  listUsers: listAdminUsers,
  applyRoleChanges: applyAdminRoleChanges,
});
