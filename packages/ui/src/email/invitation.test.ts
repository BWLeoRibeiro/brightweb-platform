import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInvitationEmail,
  emailBrandNameFromSender,
  transactionalEmailPaletteFromEnv,
} from "./invitation";

test("invitation email creates an accessible branded HTML and text pair", () => {
  const email = buildInvitationEmail({
    brandName: "BeGreen Consulting",
    logoUrl: "https://portal.example/brand/logo.png?variant=email&theme=dark",
    preheader: "Tem um convite novo.",
    eyebrow: "Convite para o portal",
    title: "O seu acesso começa aqui",
    introduction: "Foi convidado para colaborar.",
    details: [
      { label: "Organização", value: "Verde & Filhos <Lda>" },
      { label: "Perfil", value: "Membro" },
    ],
    actionLabel: "Aceitar convite",
    actionUrl: "https://portal.example/invite/id?from=email&safe=true",
    expiresLabel: "24 de agosto de 2026",
    recipientEmail: "ana@example.com",
  });

  assert.match(email.html, /role="presentation"/);
  assert.match(email.html, /BeGreen Consulting/);
  assert.match(email.html, /logo\.png\?variant=email&amp;theme=dark/);
  assert.match(email.html, /alt="BeGreen Consulting"/);
  assert.match(email.html, /Aceitar convite/);
  assert.match(email.html, /Verde &amp; Filhos &lt;Lda&gt;/);
  assert.match(email.html, /from=email&amp;safe=true/);
  assert.doesNotMatch(email.html, /Verde & Filhos <Lda>/);
  assert.match(email.text, /Organização: Verde & Filhos <Lda>/);
  assert.match(email.text, /24 de agosto de 2026/);
  assert.match(email.html, /Este convite foi enviado para ana@example\.com/);
});

test("transactional email can use non-invitation recipient wording", () => {
  const email = buildInvitationEmail({
    brandName: "BeGreen Consulting",
    preheader: "A sua conta foi atualizada.",
    eyebrow: "Aviso de segurança",
    title: "Alteração concluída",
    introduction: "A operação foi concluída.",
    details: [{ label: "Estado", value: "Concluído" }],
    recipientEmail: "ana@example.com",
    recipientLabel: "Esta mensagem foi enviada para",
    closingNote: "Se não reconhece esta mensagem, pode ignorá-la em segurança.",
  });

  assert.match(email.html, /Esta mensagem foi enviada para ana@example\.com/);
  assert.match(email.text, /Esta mensagem foi enviada para ana@example\.com/);
  assert.doesNotMatch(email.html, /convite/i);
});

test("email brand name follows the configured sender display name", () => {
  assert.equal(emailBrandNameFromSender("BeGreen Consulting <portal@begreen.com.pt>"), "BeGreen Consulting");
  assert.equal(emailBrandNameFromSender("portal@begreen.com.pt"), "Portal");
  assert.equal(emailBrandNameFromSender("portal@begreen.com.pt", "Área de cliente"), "Área de cliente");
});

test("transactional email supports security notices without an action", () => {
  const email = buildInvitationEmail({
    brandName: "BeGreen Consulting",
    preheader: "A sua conta foi atualizada.",
    eyebrow: "Aviso de segurança",
    title: "Alteração concluída",
    introduction: "A operação foi concluída.",
    details: [{ label: "Estado", value: "Concluído" }],
  });

  assert.doesNotMatch(email.html, /Se o botão não funcionar/);
  assert.doesNotMatch(email.html, /href="null"/);
  assert.match(email.text, /Estado: Concluído/);
});

test("transactional email applies a project palette and rejects unsafe colors", () => {
  const palette = transactionalEmailPaletteFromEnv({
    EMAIL_BRAND_COLOR_HEADER: "#0A151A",
    EMAIL_BRAND_COLOR_ACCENT: "#5bc5f2",
    EMAIL_BRAND_COLOR_BUTTON: "red;display:none",
  });
  const email = buildInvitationEmail({
    brandName: "MQ Consulting",
    preheader: "Tem um convite novo.",
    eyebrow: "Convite",
    title: "Bem-vindo",
    introduction: "Entre no portal.",
    details: [{ label: "Perfil", value: "Membro" }],
    actionLabel: "Entrar",
    actionUrl: "https://portal.example/invite",
    palette,
  });

  assert.match(email.html, /background:#0A151A/);
  assert.match(email.html, /color:#5bc5f2/);
  assert.match(email.html, /bgcolor="#125b48"/);
  assert.doesNotMatch(email.html, /red;display:none/);
});
