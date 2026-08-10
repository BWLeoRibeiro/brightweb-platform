import assert from "node:assert/strict";
import test from "node:test";

import { createAuthEmailTemplates } from "./templates";

test("auth email templates cover every supported account flow", () => {
  const templates = createAuthEmailTemplates({
    brandName: "BeGreen Consulting",
    logoUrl: "https://portal.example/brand/logo-email.png",
    portalUrl: "https://portal.example",
    palette: { header: "#0a151a", accent: "#5bc5f2" },
  });

  assert.deepEqual(Object.keys(templates), [
    "recovery",
    "magicLink",
    "confirmation",
    "emailChange",
    "reauthentication",
    "passwordChanged",
    "emailChanged",
    "phoneChanged",
    "mfaFactorEnrolled",
    "mfaFactorUnenrolled",
    "identityLinked",
    "identityUnlinked",
  ]);
  assert.match(templates.recovery.html, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(templates.recovery.html, /Redefinir palavra-passe/);
  assert.match(templates.recovery.html, /background:#0a151a/);
  assert.match(templates.recovery.html, /color:#5bc5f2/);
  assert.match(templates.emailChange.html, /\{\{ \.NewEmail \}\}/);
  assert.match(templates.reauthentication.html, /\{\{ \.Token \}\}/);
  assert.doesNotMatch(templates.reauthentication.html, /Se o botão não funcionar/);
  assert.match(templates.passwordChanged.html, /https:\/\/portal\.example/);
  assert.match(templates.emailChanged.html, /\{\{ \.OldEmail \}\}/);
  assert.match(templates.phoneChanged.html, /\{\{ \.Phone \}\}/);
  assert.match(templates.mfaFactorEnrolled.html, /autentica(?:ç|&#231;)ão multifator/i);
  assert.match(templates.identityUnlinked.html, /Identidade removida/);
  for (const template of Object.values(templates)) {
    assert.match(template.html, /Esta mensagem foi enviada para/);
    assert.doesNotMatch(template.html, /Este convite foi enviado para/);
    assert.doesNotMatch(template.text, /Este convite foi enviado para/);
  }
});
