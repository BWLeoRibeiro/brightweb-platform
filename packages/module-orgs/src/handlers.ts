import { requireOrganizationManageAccess, requireOrganizationsStaffAccess } from "./access";
import {
  createOrganization,
  deleteOrganization,
  removeOrganizationMember,
  updateOrganization,
  updateOrganizationMemberRole,
} from "./data";
import {
  inviteOrganizationMembers,
  logOrganizationActivity,
  listOrganizationInvitations,
  listOrganizationMemberViews,
  resendOrganizationInvitation,
  revokeOrganizationInvitation,
  type EnsureCrmContact,
} from "./invitations";
import {
  createOrganizationInvitationDeleteHandler,
  createOrganizationInvitationResendHandler,
  createOrganizationDeleteHandler,
  createOrganizationInvitationsHandler,
  createOrganizationMemberMutationHandlers,
  createOrganizationPatchHandler,
  createOrganizationsPostHandler,
} from "./http";

export function createOrganizationRequestHandlers(options?: { ensureCrmContactForProfile?: EnsureCrmContact }) {
  const inviteMembers: typeof inviteOrganizationMembers = (supabase, organizationId, invites, actorProfileId) =>
    inviteOrganizationMembers(supabase, organizationId, invites, actorProfileId, {
      ensureCrmContactForProfile: options?.ensureCrmContactForProfile,
    });
  const writeDependencies = {
    getCreateAccess: requireOrganizationsStaffAccess,
    getManageAccess: requireOrganizationManageAccess,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    inviteMembers,
    logActivity: logOrganizationActivity,
  };
  const invitationDependencies = {
    getManageAccess: requireOrganizationManageAccess,
    inviteMembers,
    listInvitations: listOrganizationInvitations,
    listMembers: listOrganizationMemberViews,
    revokeInvitation: revokeOrganizationInvitation,
    resendInvitation: resendOrganizationInvitation,
    logActivity: logOrganizationActivity,
  };
  const invitationHandlers = createOrganizationInvitationsHandler(invitationDependencies);
  const memberMutationHandlers = createOrganizationMemberMutationHandlers({
    getManageAccess: requireOrganizationManageAccess,
    updateMemberRole: updateOrganizationMemberRole,
    removeMember: removeOrganizationMember,
    logActivity: logOrganizationActivity,
  });
  return {
    organizationsPost: createOrganizationsPostHandler(writeDependencies),
    organizationPatch: createOrganizationPatchHandler(writeDependencies),
    organizationDelete: createOrganizationDeleteHandler(writeDependencies),
    invitationsGet: invitationHandlers.GET,
    invitationsPost: invitationHandlers.POST,
    invitationDelete: createOrganizationInvitationDeleteHandler(invitationDependencies),
    invitationResend: createOrganizationInvitationResendHandler(invitationDependencies),
    memberPatch: memberMutationHandlers.PATCH,
    memberDelete: memberMutationHandlers.DELETE,
  };
}

const handlers = createOrganizationRequestHandlers();
export const handleOrganizationsPostRequest = handlers.organizationsPost;
export const handleOrganizationPatchRequest = handlers.organizationPatch;
export const handleOrganizationDeleteRequest = handlers.organizationDelete;
export const handleOrganizationInvitationsGetRequest = handlers.invitationsGet;
export const handleOrganizationInvitationsPostRequest = handlers.invitationsPost;
export const handleOrganizationInvitationDeleteRequest = handlers.invitationDelete;
export const handleOrganizationInvitationResendRequest = handlers.invitationResend;
export const handleOrganizationMemberPatchRequest = handlers.memberPatch;
export const handleOrganizationMemberDeleteRequest = handlers.memberDelete;
