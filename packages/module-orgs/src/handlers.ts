import { requireOrganizationManageAccess, requireOrganizationsStaffAccess } from "./access";
import { createOrganization, updateOrganization } from "./data";
import {
  inviteOrganizationMembers,
  logOrganizationActivity,
  listOrganizationInvitations,
  listOrganizationMemberViews,
  revokeOrganizationInvitation,
} from "./invitations";
import {
  createOrganizationInvitationDeleteHandler,
  createOrganizationInvitationsHandler,
  createOrganizationPatchHandler,
  createOrganizationsPostHandler,
} from "./http";

const writeDependencies = {
  getCreateAccess: requireOrganizationsStaffAccess,
  getManageAccess: requireOrganizationManageAccess,
  createOrganization,
  updateOrganization,
  inviteMembers: inviteOrganizationMembers,
  logActivity: logOrganizationActivity,
};

const invitationDependencies = {
  getManageAccess: requireOrganizationManageAccess,
  inviteMembers: inviteOrganizationMembers,
  listInvitations: listOrganizationInvitations,
  listMembers: listOrganizationMemberViews,
  revokeInvitation: revokeOrganizationInvitation,
  logActivity: logOrganizationActivity,
};

export const handleOrganizationsPostRequest = createOrganizationsPostHandler(writeDependencies);
export const handleOrganizationPatchRequest = createOrganizationPatchHandler(writeDependencies);

const invitationHandlers = createOrganizationInvitationsHandler(invitationDependencies);
export const handleOrganizationInvitationsGetRequest = invitationHandlers.GET;
export const handleOrganizationInvitationsPostRequest = invitationHandlers.POST;
export const handleOrganizationInvitationDeleteRequest =
  createOrganizationInvitationDeleteHandler(invitationDependencies);
