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
  expiresAt?: string;
}): Promise<boolean> {
  try {
    const signupUrl = new URL(`admin-invite/${params.invitationId}`, `${getAuthBaseUrl()}/`).toString();
    const roleLabel = params.role === "admin" ? "Administrador" : "Colaborador";
    const expiryDate = params.expiresAt ? new Date(params.expiresAt) : null;
    const expiresLabel = expiryDate && !Number.isNaN(expiryDate.getTime())
      ? new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(expiryDate)
      : null;
    await resendApiRequest<{ id?: string }>("/emails", {
      method: "POST",
      body: JSON.stringify({
        from: getTransactionalSender(),
        to: [params.invitedEmail],
        subject: "Convite para aceder ao portal",
        html: `<!doctype html>
<html lang="pt">
  <body style="margin:0;background:#f3f1ec;color:#25282b;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">Crie o seu acesso seguro ao portal.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f1ec;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #dedbd3;">
            <tr><td style="height:6px;background:#2f5d50;font-size:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:40px 40px 20px;">
                <p style="margin:0 0 14px;color:#627069;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Acesso ao portal</p>
                <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:30px;line-height:1.2;font-weight:500;color:#1e2925;">Foi convidado para colaborar</h1>
                <p style="margin:0;color:#4f5854;font-size:16px;line-height:1.65;">Foi-lhe atribuído o perfil de <strong style="color:#25282b;">${roleLabel}</strong>. Crie a sua conta para aceitar o convite e entrar no portal.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 28px;">
                <a href="${signupUrl}" style="display:inline-block;background:#2f5d50;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 22px;">Criar acesso seguro</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 36px;">
                ${expiresLabel ? `<p style="margin:0 0 14px;color:#626965;font-size:13px;line-height:1.5;">Este convite é válido até <strong>${expiresLabel}</strong>.</p>` : ""}
                <p style="margin:0;color:#777d79;font-size:12px;line-height:1.6;">Se o botão não funcionar, copie este endereço para o navegador:<br><a href="${signupUrl}" style="color:#2f5d50;word-break:break-all;">${signupUrl}</a></p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;color:#7b817e;font-size:12px;line-height:1.5;">Se não esperava este convite, pode ignorar esta mensagem.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`,
        text: `Foi convidado para aceder ao portal como ${roleLabel}.\n\nCrie o seu acesso seguro:\n${signupUrl}${expiresLabel ? `\n\nConvite válido até ${expiresLabel}.` : ""}\n\nSe não esperava este convite, ignore esta mensagem.`,
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
