import { requireServerRoleAccess } from "@brightweblabs/core-auth/server";
import { requireServiceRoleClient } from "@brightweblabs/infra/server";
import {
  createAdminUserInvitationDeleteHandler,
  createAdminUserInvitationsHandler,
  createAdminUsersGetHandler,
  createAdminUsersRoleChangeHandler,
} from "./http";
import { applyAdminRoleChanges } from "./roles";
import { listAdminUsers } from "./users-data";
import {
  createAdminUserInvitation,
  listAdminUserInvitations,
  revokeAdminUserInvitation,
} from "./invitations";

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

const invitationDependencies = {
  getAccess: () => requireServerRoleAccess("admin"),
  getServiceClient: requireServiceRoleClient,
  listInvitations: listAdminUserInvitations,
  createInvitation: createAdminUserInvitation,
  revokeInvitation: revokeAdminUserInvitation,
};

const invitationHandlers = createAdminUserInvitationsHandler(invitationDependencies);
export const handleAdminUserInvitationsGetRequest = invitationHandlers.GET;
export const handleAdminUserInvitationsPostRequest = invitationHandlers.POST;
export const handleAdminUserInvitationDeleteRequest =
  createAdminUserInvitationDeleteHandler(invitationDependencies);
