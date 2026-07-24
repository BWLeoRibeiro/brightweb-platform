import "server-only";

import {
  getTransactionalSender,
  resendApiRequest,
  ResendConfigError,
} from "@brightweblabs/infra/server";
import { getAuthBaseUrl } from "@brightweblabs/core-auth/shared";
import type { OrganizationMemberRole } from "./data";

type SendOrganizationInviteEmailParams = {
  invitationId: string;
  organizationName: string;
  invitedEmail: string;
  role: OrganizationMemberRole;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSignupUrl(invitationId: string): string {
  return new URL(`invite/${invitationId}`, `${getAuthBaseUrl()}/`).toString();
}

export async function sendOrganizationInviteEmail(
  params: SendOrganizationInviteEmailParams,
): Promise<boolean> {
  try {
    const signupUrl = buildSignupUrl(params.invitationId);
    const roleLabel = params.role === "admin" ? "Administrador" : "Membro";
    const safeOrganization = escapeHtml(params.organizationName);
    const safeUrl = escapeHtml(signupUrl);

    await resendApiRequest<{ id?: string }>("/emails", {
      method: "POST",
      body: JSON.stringify({
        from: getTransactionalSender(),
        to: [params.invitedEmail],
        subject: `Convite para a organização ${params.organizationName}`,
        html: `<p>Foi convidado(a) para <strong>${safeOrganization}</strong> como ${roleLabel}.</p><p><a href="${safeUrl}">Aceitar convite</a></p>`,
        text: `Convite para ${params.organizationName} (${roleLabel})\n\n${signupUrl}`,
        tags: [
          { name: "flow", value: "organization_invite" },
          { name: "org_role", value: params.role },
        ],
      }),
    });

    return true;
  } catch (error) {
    if (!(error instanceof ResendConfigError)) {
      console.error("Organization invite email failed", {
        invitationId: params.invitationId,
        invitedEmail: params.invitedEmail,
        error,
      });
    }
    return false;
  }
}
