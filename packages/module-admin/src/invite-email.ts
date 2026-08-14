import "server-only";

import { getAuthBaseUrl } from "@brightweblabs/core-auth/shared";
import {
  getTransactionalSender,
  resendApiRequest,
  ResendConfigError,
} from "@brightweblabs/infra/server";
import {
  buildInvitationEmail,
  emailBrandNameFromSender,
  transactionalEmailPaletteFromEnv,
} from "@brightweblabs/ui/email/invitation";
import type { AdminInviteRole } from "./invitations";

export async function sendAdminUserInviteEmail(params: {
  invitationId: string;
  invitedEmail: string;
  role: AdminInviteRole;
  expiresAt?: string;
}): Promise<boolean> {
  try {
    const signupUrl = new URL(`admin-invite/${params.invitationId}`, `${getAuthBaseUrl()}/`).toString();
    const roleLabel = params.role === "admin"
      ? "Administrador"
      : params.role === "client"
        ? "Cliente"
        : "Colaborador";
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
      preheader: `Foi convidado para colaborar no ${brandName}.`,
      eyebrow: "Convite para o portal",
      title: "O seu acesso começa aqui",
      introduction: `Foi convidado para colaborar no ${brandName}. Confirme o convite para criar a sua conta e entrar no portal.`,
      details: [
        { label: "Perfil atribuído", value: roleLabel },
        { label: "Acesso", value: "Portal completo" },
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
        subject: `${brandName}: convite para aceder ao portal`,
        html: email.html,
        text: email.text,
        tags: [
          { name: "flow", value: "admin_user_invite" },
          { name: "role", value: params.role },
        ],
      }),
    });
    return true;
  } catch (error) {
    if (!(error instanceof ResendConfigError)) {
      console.error("Admin user invite email failed", {
        invitationId: params.invitationId,
        invitedEmail: params.invitedEmail,
        error,
      });
    }
    return false;
  }
}
