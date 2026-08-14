import assert from "node:assert/strict";
import test from "node:test";

import { createAuthEmailTemplates } from "./templates";
import {
  compareSupabaseAuthEmailTemplates,
  createSupabaseAuthEmailTemplatePayload,
  syncSupabaseAuthEmailTemplates,
} from "./supabase-management.impl";

const PROJECT_REF = "abcdefghijklmnopqrst";

function templates(brandName: string) {
  return createAuthEmailTemplates({
    brandName,
    logoUrl: "https://portal.example/brand/logo-email.png",
    portalUrl: "https://portal.example",
  });
}

test("maps all 12 auth templates to the 24 supported Management API fields", () => {
  const payload = createSupabaseAuthEmailTemplatePayload(templates("Acme"));

  assert.equal(Object.keys(payload).length, 24);
  assert.equal(payload.mailer_subjects_recovery, "Acme: redefinir palavra-passe");
  assert.match(payload.mailer_templates_recovery_content, /\{\{ \.ConfirmationURL \}\}/);
  assert.equal(payload.mailer_subjects_identity_unlinked_notification, "Acme: identidade removida");
  assert.match(payload.mailer_templates_identity_unlinked_notification_content, /Identidade removida/);
});

test("backs up, patches only template fields, and verifies hosted parity", async () => {
  const expectedTemplates = templates("New Brand");
  const oldPayload = createSupabaseAuthEmailTemplatePayload(templates("Old Brand"));
  const state: Record<string, unknown> = {
    ...oldPayload,
    mailer_subjects_invite: "Existing invite",
    mailer_templates_invite_content: "<p>Existing invite</p>",
    mailer_subjects_custom_contents: {},
    mailer_templates_custom_contents: {},
    smtp_host: "smtp.example",
    smtp_sender_name: "Existing Sender",
    site_url: "https://portal.example",
  };
  const events: string[] = [];
  let patchBody: Record<string, unknown> | undefined;
  const fetcher: typeof fetch = async (_input, init) => {
    if (init?.method === "PATCH") {
      events.push("patch");
      patchBody = JSON.parse(String(init.body)) as Record<string, unknown>;
      Object.assign(state, patchBody, {
        mailer_subjects_custom_contents: { MAILER_SUBJECTS_RECOVERY: true },
        mailer_templates_custom_contents: { MAILER_TEMPLATES_RECOVERY_CONTENT: true },
      });
    }
    return new Response(JSON.stringify(state), { status: 200 });
  };

  const result = await syncSupabaseAuthEmailTemplates({
    accessToken: "secret",
    projectRef: PROJECT_REF,
    templates: expectedTemplates,
    fetcher,
    onBackup(backup) {
      events.push("backup");
      assert.deepEqual(backup.rollbackPayload, oldPayload);
    },
  });

  assert.deepEqual(events, ["backup", "patch"]);
  assert.equal(Object.keys(patchBody ?? {}).length, 24);
  assert.ok(Object.keys(patchBody ?? {}).every((field) =>
    field.startsWith("mailer_subjects_") || field.startsWith("mailer_templates_")));
  assert.equal(result.changed, true);
  assert.equal(result.mismatchesBefore.length, 24);
  assert.deepEqual(result.mismatchesAfter, []);
  assert.equal(result.nonTemplateSettingsUnchanged, true);
  assert.deepEqual(result.unexpectedChangedFields, []);
  assert.deepEqual(
    compareSupabaseAuthEmailTemplates(state, createSupabaseAuthEmailTemplatePayload(expectedTemplates)),
    [],
  );
  assert.equal(state.smtp_host, "smtp.example");
  assert.equal(state.smtp_sender_name, "Existing Sender");
  assert.equal(state.mailer_subjects_invite, "Existing invite");
});

test("does not patch when hosted templates already match", async () => {
  const expectedTemplates = templates("Acme");
  const state = createSupabaseAuthEmailTemplatePayload(expectedTemplates);
  let calls = 0;
  let backedUp = false;
  const fetcher: typeof fetch = async (_input, init) => {
    calls += 1;
    assert.notEqual(init?.method, "PATCH");
    return new Response(JSON.stringify(state), { status: 200 });
  };

  const result = await syncSupabaseAuthEmailTemplates({
    accessToken: "secret",
    projectRef: PROJECT_REF,
    templates: expectedTemplates,
    fetcher,
    onBackup() {
      backedUp = true;
    },
  });

  assert.equal(calls, 1);
  assert.equal(backedUp, true);
  assert.equal(result.changed, false);
});

test("fails verification when an unmanaged Auth setting changes", async () => {
  const expectedTemplates = templates("New Brand");
  const state: Record<string, unknown> = {
    ...createSupabaseAuthEmailTemplatePayload(templates("Old Brand")),
    smtp_host: "smtp.before.example",
  };
  const fetcher: typeof fetch = async (_input, init) => {
    if (init?.method === "PATCH") {
      Object.assign(state, JSON.parse(String(init.body)), { smtp_host: "smtp.after.example" });
    }
    return new Response(JSON.stringify(state), { status: 200 });
  };

  await assert.rejects(
    syncSupabaseAuthEmailTemplates({
      accessToken: "secret",
      projectRef: PROJECT_REF,
      templates: expectedTemplates,
      fetcher,
      onBackup() {},
    }),
    /changed unmanaged field\(s\): smtp_host/,
  );
});

test("aborts before patching when the required backup cannot be persisted", async () => {
  const state = createSupabaseAuthEmailTemplatePayload(templates("Old Brand"));
  let patched = false;
  const fetcher: typeof fetch = async (_input, init) => {
    if (init?.method === "PATCH") patched = true;
    return new Response(JSON.stringify(state), { status: 200 });
  };

  await assert.rejects(
    syncSupabaseAuthEmailTemplates({
      accessToken: "secret",
      projectRef: PROJECT_REF,
      templates: templates("New Brand"),
      fetcher,
      onBackup() {
        throw new Error("backup unavailable");
      },
    }),
    /backup unavailable/,
  );
  assert.equal(patched, false);
});

test("surfaces Management API read and update failures without claiming parity", async (t) => {
  await t.test("initial read failure", async () => {
    await assert.rejects(
      syncSupabaseAuthEmailTemplates({
        accessToken: "secret",
        projectRef: PROJECT_REF,
        templates: templates("Acme"),
        fetcher: async () => new Response(null, { status: 503 }),
        onBackup() {
          assert.fail("backup must not run without a hosted config");
        },
      }),
      /auth config read failed with HTTP 503/,
    );
  });

  await t.test("patch failure", async () => {
    const state = createSupabaseAuthEmailTemplatePayload(templates("Old Brand"));
    let calls = 0;
    await assert.rejects(
      syncSupabaseAuthEmailTemplates({
        accessToken: "secret",
        projectRef: PROJECT_REF,
        templates: templates("New Brand"),
        fetcher: async (_input, init) => {
          calls += 1;
          return init?.method === "PATCH"
            ? new Response(null, { status: 500 })
            : new Response(JSON.stringify(state), { status: 200 });
        },
        onBackup() {},
      }),
      /auth template update failed with HTTP 500/,
    );
    assert.equal(calls, 2);
  });
});

test("rejects malformed hosted config before producing an incomplete rollback payload", async () => {
  const state = createSupabaseAuthEmailTemplatePayload(templates("Old Brand"));
  delete (state as Partial<typeof state>).mailer_templates_recovery_content;

  await assert.rejects(
    syncSupabaseAuthEmailTemplates({
      accessToken: "secret",
      projectRef: PROJECT_REF,
      templates: templates("New Brand"),
      fetcher: async () => new Response(JSON.stringify(state), { status: 200 }),
      onBackup() {
        assert.fail("backup must not contain missing hosted fields");
      },
    }),
    /missing mailer_subjects_recovery or mailer_templates_recovery_content/,
  );
});

test("fails when the post-update read does not exactly match the requested templates", async () => {
  const state = createSupabaseAuthEmailTemplatePayload(templates("Old Brand"));
  const fetcher: typeof fetch = async (_input, init) => {
    if (init?.method === "PATCH") {
      const patch = JSON.parse(String(init.body)) as Record<string, unknown>;
      Object.assign(state, patch, { mailer_subjects_recovery: "stale subject" });
    }
    return new Response(JSON.stringify(state), { status: 200 });
  };

  await assert.rejects(
    syncSupabaseAuthEmailTemplates({
      accessToken: "secret",
      projectRef: PROJECT_REF,
      templates: templates("New Brand"),
      fetcher,
      onBackup() {},
    }),
    /template verification failed for 1 field\(s\)/,
  );
});
