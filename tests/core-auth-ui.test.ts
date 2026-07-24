import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createInvitationAcceptHandler,
  createInvitationDetailsHandler,
  createInvitationRegisterHandler,
  type InvitationHttpDependencies,
} from "../packages/core-auth/src/invitations.ts";
import { createAuthUiClient } from "../packages/core-auth/src/ui/client.ts";
import { defaultAuthUiDictionary } from "../packages/core-auth/src/ui/dictionary.ts";
import {
  parseInvitationAcceptResponse,
  parseInvitationDetailsResponse,
  parseInvitationRegisterResponse,
} from "../packages/core-auth/src/ui/response-parsers.ts";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const authRoot = path.join(repoRoot, "packages", "core-auth");

async function read(relativePath: string) {
  return readFile(path.join(authRoot, relativePath), "utf8");
}

test("auth UI has a substantial PT-only dictionary contract", () => {
  const leaves = (value: unknown): number =>
    typeof value === "string" || typeof value === "function"
      ? 1
      : value && typeof value === "object"
        ? Object.values(value).reduce((sum, item) => sum + leaves(item), 0)
        : 0;
  assert.equal(defaultAuthUiDictionary.locale, "pt-PT");
  assert.ok(leaves(defaultAuthUiDictionary) >= 90);
  assert.equal(defaultAuthUiDictionary.postLogin.preparing, "A preparar o seu portal…");
});

test("auth UI components use the injectable client boundary", async () => {
  const componentFiles = [
    "src/ui/login-page.tsx",
    "src/ui/forgot-password-page.tsx",
    "src/ui/reset-password-page.tsx",
    "src/ui/invite-page.tsx",
    "src/ui/post-login-page.tsx",
  ];
  for (const file of componentFiles) {
    const source = await read(file);
    assert.doesNotMatch(source, /@supabase|@brightweblabs\/infra/, `${file} must not access Supabase directly`);
  }
  const types = await read("src/ui/types.ts");
  for (const method of ["signInWithPassword", "sendMagicLink", "requestReset", "resetPassword", "registerInvite"]) {
    assert.match(types, new RegExp(`${method}\\(`));
  }
});

test("post-login preserves guarded role routing and delayed shimmer", async () => {
  const source = await read("src/ui/post-login-page.tsx");
  assert.ok(source.includes('value.startsWith("//")'));
  assert.ok(source.includes('["/dashboard", "/crm", "/projetos", "/ferramentas"]'));
  assert.match(source, /setTimeout\(\(\) => setShowSkeleton\(true\), 400\)/);
  assert.match(source, /resolvePostLoginPath\(access\.role\)/);
  assert.match(source, /router\.replace\("\/login\?error=auth_system"\)/);
});

test("login preparation surfaces session and local sign-out provider failures", async () => {
  const source = await read("src/ui/login-page.tsx");
  assert.match(source, /if \(!cancelled\) setError\(d\.authSystemError\)/);
});

test("auth tokens have neutral defaults and MQ overrides", async () => {
  const defaults = await read("tokens.css");
  const mq = await readFile(path.join(repoRoot, "packages", "theme", "themes", "mq.css"), "utf8");
  const tokens = Array.from(defaults.matchAll(/(--auth-[a-z0-9-]+)\s*:/g), (match) => match[1]).sort();
  assert.deepEqual(tokens, [
    "--auth-card-border",
    "--auth-card-radius",
    "--auth-card-shadow",
    "--auth-card-surface",
    "--auth-error-border",
    "--auth-error-foreground",
    "--auth-error-surface",
    "--auth-panel-border",
    "--auth-panel-foreground",
    "--auth-panel-muted",
    "--auth-panel-surface",
    "--auth-skeleton-highlight",
    "--auth-skeleton-surface",
    "--auth-success-border",
    "--auth-success-foreground",
    "--auth-success-surface",
    "--auth-wash",
  ]);
  for (const token of tokens) assert.match(mq, new RegExp(`${token.replaceAll("-", "\\-")}\\s*:`));
});

test("preview auth routes are thin package mounts", async () => {
  const routes = [
    "login/page.tsx",
    "forgot-password/page.tsx",
    "reset-password/page.tsx",
    "invite/[invitationId]/page.tsx",
    "admin-invite/[invitationId]/page.tsx",
    "auth/confirmed/page.tsx",
    "auth/post-login/page.tsx",
  ];
  for (const route of routes) {
    const source = await readFile(path.join(repoRoot, "apps", "platform-preview", "app", "(auth)", route), "utf8");
    assert.match(source, /@brightweblabs\/core-auth\/ui/);
  }
});

test("preview mounts invitation detail, registration, and post-login acceptance APIs", async () => {
  const routeFiles = [
    "apps/platform-preview/app/api/invitations/[invitationId]/route.ts",
    "apps/platform-preview/app/api/invitations/[invitationId]/register/route.ts",
    "apps/platform-preview/app/api/invitations/[invitationId]/accept/route.ts",
  ];
  for (const file of routeFiles) {
    const source = await readFile(path.join(repoRoot, file), "utf8");
    assert.match(source, /@brightweblabs\/core-auth\/routes/);
    assert.match(source, /invitationHttpDependencies/);
  }
});

test("auth typography overrides stay scoped and preview defaults to split layout", async () => {
  const tokens = await read("tokens.css");
  for (const selector of ["heading-2", "paragraph-small", "paragraph-mini", "eyebrow"]) {
    assert.match(tokens, new RegExp(`\\.auth-layout \\.${selector.replaceAll("-", "\\-")}`));
  }
  assert.doesNotMatch(tokens, /(?:^|\n)\.(?:heading-2|paragraph-small|paragraph-mini|eyebrow)\s*(?:,|\{)/);

  const layout = await read("src/ui/auth-layout.tsx");
  assert.match(layout, /value === "split" \|\| value === "centered"/);
  assert.match(layout, /variant \?\? queryVariant \?\? layoutVariant \?\? "centered"/);

  const provider = await readFile(path.join(repoRoot, "apps", "platform-preview", "app", "(auth)", "auth-provider.tsx"), "utf8");
  assert.match(provider, /layoutVariant="split"/);
});

test("auth primary CTAs use the shared default Button color contract", async () => {
  const files = [
    "src/ui/login-page.tsx",
    "src/ui/forgot-password-page.tsx",
    "src/ui/reset-password-page.tsx",
    "src/ui/invite-page.tsx",
  ];
  for (const file of files) {
    const source = await read(file);
    assert.doesNotMatch(
      source,
      /<Button[^>]*className="[^"]*(?:bg-primary|text-primary-foreground|hover:bg-primary)[^"]*"/,
      `${file} must not restyle primary CTA colors outside the default Button variant`,
    );
  }
});

test("auth response parsers accept handler fixtures and reject malformed successful payloads", async () => {
  const detailsFixture = {
    id: "invite-1",
    email: "person@example.com",
    status: "pending",
    expiresAt: "2026-08-01T00:00:00.000Z",
    kind: "organization",
    organizationName: "BrightWeb",
    role: "member",
  };
  const detailsHandler = createInvitationDetailsHandler(invitationDependencies({
    getOrganizationInvitation: async () => ({
      id: detailsFixture.id,
      invitedEmail: detailsFixture.email,
      status: detailsFixture.status,
      expiresAt: detailsFixture.expiresAt,
      organizationName: detailsFixture.organizationName,
      role: detailsFixture.role,
    }),
  }));
  const detailsResponse = await detailsHandler(
    new Request("https://portal.test/api/invitations/invite-1?kind=organization"),
    { params: Promise.resolve({ invitationId: "invite-1" }) },
  );
  assert.deepEqual(
    await parseInvitationDetailsResponse(detailsResponse, "organization"),
    detailsFixture,
  );

  const registerHandler = createInvitationRegisterHandler(invitationDependencies());
  const registerResponse = await registerHandler(
    new Request("https://portal.test/api/invitations/invite-1/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: "Ada",
        lastName: "Lovelace",
        password: "Valid-password-123",
        kind: "organization",
      }),
    }),
    { params: Promise.resolve({ invitationId: "invite-1" }) },
  );
  assert.deepEqual(
    await parseInvitationRegisterResponse(registerResponse),
    { email: "person@example.com" },
  );

  const acceptHandler = createInvitationAcceptHandler(invitationDependencies());
  const acceptResponse = await acceptHandler(
    new Request("https://portal.test/api/invitations/invite-1/accept", { method: "POST" }),
    { params: Promise.resolve({ invitationId: "invite-1" }) },
  );
  await parseInvitationAcceptResponse(acceptResponse);

  await assert.rejects(
    parseInvitationDetailsResponse(Response.json({ ...detailsFixture, kind: "admin" }), "organization"),
    /resposta inválida/,
  );
  await assert.rejects(
    parseInvitationDetailsResponse(Response.json({ ...detailsFixture, expiresAt: "not-a-date" }), "organization"),
    /resposta inválida/,
  );
  await assert.rejects(
    parseInvitationDetailsResponse(Response.json({ ...detailsFixture, status: "provider-specific-state" }), "organization"),
    /resposta inválida/,
  );
  await assert.rejects(
    parseInvitationRegisterResponse(Response.json({ data: { email: 42 } })),
    /resposta inválida/,
  );
  await assert.rejects(
    parseInvitationAcceptResponse(Response.json({ data: {} })),
    /resposta inválida/,
  );
});

test("auth response parsers consume the stable public error envelope", async () => {
  await assert.rejects(
    parseInvitationRegisterResponse(Response.json(
      { error: { code: "ACCOUNT_ALREADY_EXISTS", message: "Já existe uma conta." } },
      { status: 409 },
    )),
    /Já existe uma conta\./,
  );
  await assert.rejects(
    parseInvitationRegisterResponse(Response.json({ error: "raw provider error" }, { status: 500 })),
    /resposta inválida/,
  );
});

test("auth client distinguishes a successful null session from provider failure", async () => {
  let roleCalls = 0;
  const loggedOutClient = createAuthUiClient({
    createClient: (() => ({
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
      },
      rpc: async () => {
        roleCalls += 1;
        return { data: null, error: new Error("must not run") };
      },
    })) as never,
  });
  assert.deepEqual(await loggedOutClient.getPostLoginAccess(), {
    user: null,
    profileId: null,
    role: null,
    isAdmin: false,
    isStaff: false,
  });
  assert.equal(roleCalls, 0);

  const providerError = new Error("provider unavailable");
  const failedClient = createAuthUiClient({
    createClient: (() => ({
      auth: {
        getSession: async () => ({ data: { session: null }, error: providerError }),
      },
    })) as never,
  });
  await assert.rejects(failedClient.getSession(), providerError);
  await assert.rejects(failedClient.getPostLoginAccess(), providerError);

  const signedInSession = {
    session: { user: { id: "user-1", email: "person@example.com" } },
  };
  const accessClient = (roleError: Error | null, profileError: Error | null) => createAuthUiClient({
    createClient: (() => ({
      auth: {
        getSession: async () => ({ data: signedInSession, error: null }),
      },
      rpc: async () => ({ data: "staff", error: roleError }),
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "profile-1" },
              error: profileError,
            }),
          }),
        }),
      }),
    })) as never,
  });
  await assert.rejects(accessClient(providerError, null).getPostLoginAccess(), providerError);
  await assert.rejects(accessClient(null, providerError).getPostLoginAccess(), providerError);

  const authMutationClient = createAuthUiClient({
    createClient: (() => ({
      auth: {
        signOut: async () => ({ error: providerError }),
        getSession: async () => ({ data: { session: null }, error: providerError }),
      },
    })) as never,
  });
  await assert.rejects(authMutationClient.signOutLocal(), providerError);
  await assert.rejects(authMutationClient.resetPassword("Password-123"), providerError);
});

function invitationDependencies(
  overrides: Partial<InvitationHttpDependencies> = {},
): InvitationHttpDependencies {
  return {
    getServiceClient: () => ({}),
    getAccess: async () => ({
      ok: true,
      user: { email: "person@example.com" },
      profileId: "profile-1",
    }),
    getOrganizationInvitation: async () => null,
    getAdminInvitation: async () => null,
    registerOrganizationInvitation: async () => ({
      email: "person@example.com",
      organizationId: "org-1",
    }),
    registerAdminInvitation: async () => ({ email: "person@example.com", role: "staff" }),
    acceptOrganizationInvitation: async () => ({ organizationId: "org-1" }),
    ...overrides,
  };
}

test("core-auth handlers preserve domain errors and hide infrastructure messages", async (t) => {
  const originalConsoleError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => logged.push(args);
  t.after(() => {
    console.error = originalConsoleError;
  });

  const register = createInvitationRegisterHandler(invitationDependencies({
    registerOrganizationInvitation: async () => {
      throw new Error("ACCOUNT_ALREADY_EXISTS");
    },
  }));
  const registerResponse = await register(
    new Request("https://portal.test/api/invitations/invite-1/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: "Ada",
        lastName: "Lovelace",
        password: "Valid-password-123",
        kind: "organization",
      }),
    }),
    { params: Promise.resolve({ invitationId: "invite-1" }) },
  );
  assert.equal(registerResponse.status, 409);
  assert.deepEqual(await registerResponse.json(), {
    error: {
      code: "ACCOUNT_ALREADY_EXISTS",
      message: "Já existe uma conta para este e-mail. Inicie sessão para continuar.",
    },
  });

  const details = createInvitationDetailsHandler(invitationDependencies({
    getOrganizationInvitation: async () => {
      throw new Error("relation profiles contains secret-provider-detail");
    },
  }));
  const detailsResponse = await details(
    new Request("https://portal.test/api/invitations/invite-1?kind=organization"),
    { params: Promise.resolve({ invitationId: "invite-1" }) },
  );
  assert.equal(detailsResponse.status, 500);
  const body = await detailsResponse.json();
  assert.deepEqual(body, {
    error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor." },
  });
  assert.doesNotMatch(JSON.stringify(body), /secret-provider-detail/);
  assert.match(String(logged[0]?.[1]), /secret-provider-detail/);
});
