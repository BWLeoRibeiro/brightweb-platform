export type TransactionalEmailDetail = {
  label: string;
  value: string;
};

export type TransactionalEmailPalette = {
  canvas: string;
  surface: string;
  header: string;
  headerText: string;
  headerMutedText: string;
  accent: string;
  text: string;
  mutedText: string;
  border: string;
  panel: string;
  button: string;
  buttonText: string;
  warning: string;
};

export const DEFAULT_TRANSACTIONAL_EMAIL_PALETTE: TransactionalEmailPalette = {
  canvas: "#f4f0e6",
  surface: "#ffffff",
  header: "#0c4f3f",
  headerText: "#fdf7eb",
  headerMutedText: "#d9e7df",
  accent: "#bce889",
  text: "#10251f",
  mutedText: "#607168",
  border: "#dce6d2",
  panel: "#f5f7ef",
  button: "#125b48",
  buttonText: "#ffffff",
  warning: "#d99a20",
};

const TRANSACTIONAL_EMAIL_PALETTE_ENV = {
  canvas: "EMAIL_BRAND_COLOR_CANVAS",
  surface: "EMAIL_BRAND_COLOR_SURFACE",
  header: "EMAIL_BRAND_COLOR_HEADER",
  headerText: "EMAIL_BRAND_COLOR_HEADER_TEXT",
  headerMutedText: "EMAIL_BRAND_COLOR_HEADER_MUTED_TEXT",
  accent: "EMAIL_BRAND_COLOR_ACCENT",
  text: "EMAIL_BRAND_COLOR_TEXT",
  mutedText: "EMAIL_BRAND_COLOR_MUTED_TEXT",
  border: "EMAIL_BRAND_COLOR_BORDER",
  panel: "EMAIL_BRAND_COLOR_PANEL",
  button: "EMAIL_BRAND_COLOR_BUTTON",
  buttonText: "EMAIL_BRAND_COLOR_BUTTON_TEXT",
  warning: "EMAIL_BRAND_COLOR_WARNING",
} as const satisfies Record<keyof TransactionalEmailPalette, string>;

function validHexColor(value: string | null | undefined): value is string {
  return Boolean(value?.match(/^#[0-9a-f]{6}$/i));
}

function resolveTransactionalEmailPalette(
  palette?: Partial<TransactionalEmailPalette>,
): TransactionalEmailPalette {
  return Object.fromEntries(
    Object.entries(DEFAULT_TRANSACTIONAL_EMAIL_PALETTE).map(([key, fallback]) => {
      const configured = palette?.[key as keyof TransactionalEmailPalette];
      return [key, validHexColor(configured) ? configured : fallback];
    }),
  ) as TransactionalEmailPalette;
}

export function transactionalEmailPaletteFromEnv(
  env: Record<string, string | undefined>,
): Partial<TransactionalEmailPalette> {
  return Object.fromEntries(
    Object.entries(TRANSACTIONAL_EMAIL_PALETTE_ENV).flatMap(([key, envName]) => {
      const value = env[envName]?.trim();
      return validHexColor(value) ? [[key, value]] : [];
    }),
  );
}

export type TransactionalEmailContent = {
  brandName: string;
  logoUrl?: string | null;
  logoAlt?: string;
  preheader: string;
  eyebrow: string;
  title: string;
  introduction: string;
  details: TransactionalEmailDetail[];
  actionLabel?: string;
  actionUrl?: string;
  expiresLabel?: string | null;
  recipientEmail?: string;
  closingNote?: string;
  palette?: Partial<TransactionalEmailPalette>;
};

export type TransactionalEmail = {
  html: string;
  text: string;
};

export type InvitationEmailDetail = TransactionalEmailDetail;
export type InvitationEmailContent = TransactionalEmailContent;
export type InvitationEmail = TransactionalEmail;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailBrandNameFromSender(sender: string, fallback = "Portal"): string {
  const displayName = sender.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  return displayName || fallback;
}

export function buildTransactionalEmail(content: TransactionalEmailContent): TransactionalEmail {
  const palette = resolveTransactionalEmailPalette(content.palette);
  const brandName = escapeHtml(content.brandName);
  const logoUrl = content.logoUrl ? escapeHtml(content.logoUrl) : null;
  const logoAlt = escapeHtml(content.logoAlt ?? content.brandName);
  const preheader = escapeHtml(content.preheader);
  const eyebrow = escapeHtml(content.eyebrow);
  const title = escapeHtml(content.title);
  const introduction = escapeHtml(content.introduction);
  const actionLabel = content.actionLabel ? escapeHtml(content.actionLabel) : null;
  const actionUrl = content.actionUrl ? escapeHtml(content.actionUrl) : null;
  const hasAction = Boolean(actionLabel && actionUrl);
  const expiresLabel = content.expiresLabel ? escapeHtml(content.expiresLabel) : null;
  const recipientEmail = content.recipientEmail ? escapeHtml(content.recipientEmail) : null;
  const closingNote = escapeHtml(content.closingNote ?? "Se não reconhece este convite, pode ignorar esta mensagem em segurança.");
  const detailRows = content.details.map((detail, index) => `
                    <tr>
                      <td style="padding:${index === 0 ? "0 0 18px" : "18px 0"};${index > 0 ? `border-top:1px solid ${palette.border};` : ""}">
                        <p style="margin:0 0 5px;color:${palette.mutedText};font-size:11px;font-weight:700;line-height:1.4;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(detail.label)}</p>
                        <p style="margin:0;color:${palette.text};font-size:16px;font-weight:700;line-height:1.45;">${escapeHtml(detail.value)}</p>
                      </td>
                    </tr>`).join("");

  const html = `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:${palette.canvas};color:${palette.text};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;">${preheader}&#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${palette.canvas};">
      <tr>
        <td align="center" style="padding:36px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:${palette.surface};border:1px solid ${palette.border};border-radius:20px;overflow:hidden;box-shadow:0 18px 48px rgba(16,37,31,.10);">
            <tr>
              <td style="padding:30px 34px 34px;background:${palette.header};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:0 0 42px;">
                      ${logoUrl
                        ? `<img src="${logoUrl}" width="164" alt="${logoAlt}" style="display:block;width:164px;max-width:100%;height:auto;border:0;color:${palette.headerText};font-size:13px;font-weight:700;">`
                        : `<span style="display:inline-block;width:11px;height:11px;margin-right:9px;border-radius:50%;background:${palette.accent};vertical-align:1px;"></span><span style="color:${palette.headerText};font-size:13px;font-weight:800;letter-spacing:.04em;">${brandName}</span>`}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p style="margin:0 0 13px;color:${palette.accent};font-size:11px;font-weight:800;line-height:1.4;letter-spacing:.1em;text-transform:uppercase;">${eyebrow}</p>
                      <h1 style="margin:0 0 17px;color:${palette.headerText};font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:400;line-height:1.13;letter-spacing:-.02em;">${title}</h1>
                      <p style="margin:0;max-width:480px;color:${palette.headerMutedText};font-size:16px;line-height:1.65;">${introduction}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 34px 34px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 26px;background:${palette.panel};border:1px solid ${palette.border};border-radius:14px;">
                  <tr>
                    <td style="padding:20px 22px 2px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        ${detailRows}
                      </table>
                    </td>
                  </tr>
                </table>
                ${hasAction ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td bgcolor="${palette.button}" style="border-radius:999px;">
                      <a href="${actionUrl}" style="display:inline-block;padding:14px 24px;color:${palette.buttonText};font-size:15px;font-weight:800;line-height:1.2;text-decoration:none;border-radius:999px;">${actionLabel}&nbsp;&nbsp;&rarr;</a>
                    </td>
                  </tr>
                </table>` : ""}
                ${expiresLabel ? `<p style="margin:22px 0 0;color:${palette.mutedText};font-size:13px;line-height:1.55;"><span style="color:${palette.warning};">&#9679;</span>&nbsp; Este convite é válido até <strong style="color:${palette.text};">${expiresLabel}</strong>.</p>` : ""}
                ${hasAction ? `<p style="margin:25px 0 0;padding-top:22px;border-top:1px solid ${palette.border};color:${palette.mutedText};font-size:12px;line-height:1.65;">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${actionUrl}" style="color:${palette.button};text-decoration:underline;word-break:break-all;">${actionUrl}</a></p>` : ""}
              </td>
            </tr>
          </table>
          <p style="margin:18px auto 0;max-width:540px;color:${palette.mutedText};font-size:11px;line-height:1.6;text-align:center;">${closingNote}${recipientEmail ? `<br>Este convite foi enviado para ${recipientEmail}.` : ""}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const detailText = content.details.map((detail) => `${detail.label}: ${detail.value}`).join("\n");
  const actionText = hasAction ? `\n\n${content.actionLabel}:\n${content.actionUrl}` : "";
  const text = `${content.brandName}\n\n${content.title}\n\n${content.introduction}\n\n${detailText}${actionText}${content.expiresLabel ? `\n\nEste convite é válido até ${content.expiresLabel}.` : ""}\n\n${content.closingNote ?? "Se não reconhece este convite, pode ignorar esta mensagem em segurança."}${content.recipientEmail ? `\nEste convite foi enviado para ${content.recipientEmail}.` : ""}`;

  return { html, text };
}

export const buildInvitationEmail = buildTransactionalEmail;
