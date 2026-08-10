import "server-only";

import {
  getTransactionalSender,
  resendApiRequest,
  ResendConfigError,
} from "@brightweblabs/infra/server";
import { getAuthBaseUrl } from "@brightweblabs/core-auth/shared";
import {
  buildInvitationEmail,
  emailBrandNameFromSender,
  transactionalEmailPaletteFromEnv,
} from "@brightweblabs/ui/email/invitation";
import type { OrganizationMemberRole } from "./data";

type SendOrganizationInviteEmailParams = {
  invitationId: string;
  organizationName: string;
  invitedEmail: string;
  role: OrganizationMemberRole;
  expiresAt?: string;
};

function buildSignupUrl(invitationId: string): string {
  return new URL(`invite/${invitationId}`, `${getAuthBaseUrl()}/`).toString();
}

export async function sendOrganizationInviteEmail(
  params: SendOrganizationInviteEmailParams,
): Promise<boolean> {
  try {
    const signupUrl = buildSignupUrl(params.invitationId);
    const roleLabel = params.role === "admin" ? "Administrador" : "Membro";
    const sender = getTransactionalSender();
    const brandName = process.env.EMAIL_BRAND_NAME?.trim() || emailBrandNameFromSender(sender);
    const logoPath = process.env.EMAIL_BRAND_LOGO_URL?.trim();
    const logoUrl = logoPath ? new URL(logoPath, `${getAuthBaseUrl()}/`).toString() : null;
    const expiryDate = params.expiresAt ? new Date(params.expiresAt) : null;
    const expiresLabel = expiryDate && !Number.isNaN(expiryDate.getTime())
      ? new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(expiryDate)
      : null;
    const email = buildInvitationEmail({
      brandName,
      logoUrl,
      logoAlt: brandName,
      preheader: `Foi convidado para colaborar com ${params.organizationName}.`,
      eyebrow: "Convite para uma organização",
      title: "Há uma equipa à sua espera",
      introduction: `Aceite o convite para colaborar com ${params.organizationName} através do ${brandName}.`,
      details: [
        { label: "Organização", value: params.organizationName },
        { label: "Nível de acesso", value: roleLabel },
      ],
      actionLabel: "Aceitar convite",
      actionUrl: signupUrl,
      expiresLabel,
      recipientEmail: params.invitedEmail,
      palette: transactionalEmailPaletteFromEnv(process.env),
    });

    await resendApiRequest<{ id?: string }>("/emails", {
      method: "POST",
      body: JSON.stringify({
        from: sender,
        to: [params.invitedEmail],
        subject: `${brandName}: convite para ${params.organizationName}`,
        html: email.html,
        text: email.text,
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
