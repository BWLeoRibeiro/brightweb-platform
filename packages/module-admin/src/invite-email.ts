import "server-only";

import { getAuthBaseUrl } from "@brightweblabs/core-auth/shared";
import {
  getTransactionalSender,
  resendApiRequest,
  ResendConfigError,
} from "@brightweblabs/infra/server";
import type { AdminInviteRole } from "./invitations";

export async function sendAdminUserInviteEmail(params: {
  invitationId: string;
  invitedEmail: string;
  role: AdminInviteRole;
}): Promise<boolean> {
  try {
    const signupUrl = new URL(`admin-invite/${params.invitationId}`, `${getAuthBaseUrl()}/`).toString();
    const roleLabel = params.role === "admin" ? "Administrador" : "Colaborador";
    await resendApiRequest<{ id?: string }>("/emails", {
      method: "POST",
      body: JSON.stringify({
        from: getTransactionalSender(),
        to: [params.invitedEmail],
        subject: "Convite para a plataforma",
        html: `<p>Foi convidado(a) para a plataforma como <strong>${roleLabel}</strong>.</p><p><a href="${signupUrl}">Criar acesso</a></p>`,
        text: `Convite para a plataforma (${roleLabel})\n\n${signupUrl}`,
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
