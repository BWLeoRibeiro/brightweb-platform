import { requireServerUserAccess } from "@brightweblabs/core-auth/server";
import { requireServiceRoleClient } from "@brightweblabs/infra/server";
import {
  getAdminUserInvitationDetails,
  registerUserFromAdminInvitation,
} from "@brightweblabs/module-admin";
import { ensureCrmContactForProfile } from "@brightweblabs/module-crm";
import {
  acceptOrganizationInvitation,
  getOrganizationInvitationDetails,
  registerUserFromOrganizationInvitation,
} from "@brightweblabs/module-orgs";

export const invitationHttpDependencies = {
  getServiceClient: requireServiceRoleClient,
  getAccess: requireServerUserAccess,
  getOrganizationInvitation: getOrganizationInvitationDetails,
  getAdminInvitation: getAdminUserInvitationDetails,
  registerOrganizationInvitation: (client: never, input: {
    invitationId: string;
    firstName: string;
    lastName: string;
    password: string;
  }) => registerUserFromOrganizationInvitation(client, {
    ...input,
    ensureCrmContactForProfile,
  }),
  registerAdminInvitation: registerUserFromAdminInvitation,
  acceptOrganizationInvitation: (client: never, input: {
    invitationId: string;
    profileId: string;
    userEmail: string;
  }) => acceptOrganizationInvitation(client, {
    ...input,
    ensureCrmContactForProfile,
  }),
};
