import { requireServerRoleAccess } from "@brightweblabs/core-auth/server";
import { createAdminUsersGetHandler, createAdminUsersRoleChangeHandler } from "./http";
import { applyAdminRoleChanges } from "./roles";
import { listAdminUsers } from "./users-data";

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
