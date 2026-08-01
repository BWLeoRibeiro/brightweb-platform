// Authenticated runtime smoke test for generated apps (issue #77).
//
// CI's static gates (tsc, next build, bw doctor) cannot see request-time
// failures: the generated app's data-backed pages are async and never
// prerendered. This runner generates a real platform fixture with create-bw-app,
// builds and serves it with `next build` / `next start`, points it at an
// in-process Supabase stub (tests/e2e/supabase-stub.mjs), establishes a real
// authenticated session through @supabase/ssr, and asserts that the
// authenticated pages render and the dashboard APIs satisfy the real
// @brightweblabs/app-shell response parsers.
//
// Run: node tests/e2e/generated-app-smoke.mjs

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { createBrightwebClientApp } from "../../packages/create-bw-app/src/generator.mjs";
import { SELECTABLE_MODULES } from "../../packages/create-bw-app/src/constants.mjs";
import { startSupabaseStub } from "./supabase-stub.mjs";
import { CRM_TOTAL_CONTACTS, SECOND_PROFILE_ID, USER_EMAIL, USER_PASSWORD } from "./fixtures.mjs";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const previewNodeModules = path.join(repoRoot, "apps", "platform-preview", "node_modules");
const nextCli = path.join(previewNodeModules, "next", "dist", "bin", "next");
const verbose = process.env.SMOKE_VERBOSE === "1";

const timings = [];

async function timed(label, work) {
  const startedAt = performance.now();
  const result = await work();
  const seconds = (performance.now() - startedAt) / 1_000;
  timings.push({ label, seconds });
  console.log(`[smoke] ${label}: ${seconds.toFixed(1)}s`);
  return result;
}

let assertionCount = 0;

function assert(condition, message) {
  assertionCount += 1;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ok - ${message}`);
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function runCommand(label, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ...(options.env ?? {}) },
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    const capture = (chunk) => {
      output += chunk;
      if (verbose) process.stdout.write(chunk);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode === 0) return resolve(output);
      reject(new Error(`${label} failed with exit code ${exitCode}.\n${output}`));
    });
  });
}

async function importDashboardParsers() {
  // The real contract lives in TypeScript; Node 22.18+/23.6+ strips types
  // natively, and the module's only imports are `import type` (erased).
  const parserPath = path.join(
    repoRoot,
    "packages",
    "app-shell",
    "src",
    "dashboard",
    "dashboard-response-parser.ts",
  );
  try {
    return await import(pathToFileURL(parserPath).href);
  } catch (error) {
    throw new Error(
      "Could not import the app-shell dashboard parsers from TypeScript source. "
        + "Node 22.18+ (or 23.6+) with native type stripping is required; "
        + `current version: ${process.version}. Original error: ${error}`,
    );
  }
}

function createCookieJar() {
  const jar = new Map();
  return {
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    setAll: (cookies) => {
      for (const { name, value } of cookies) {
        if (value === "") jar.delete(name);
        else jar.set(name, value);
      }
    },
    header: () => [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
    absorbResponse: (response) => {
      for (const setCookie of response.headers.getSetCookie()) {
        const [pair] = setCookie.split(";");
        const separatorIndex = pair.indexOf("=");
        if (separatorIndex <= 0) continue;
        const name = pair.slice(0, separatorIndex).trim();
        const value = pair.slice(separatorIndex + 1).trim();
        const isExpired = /max-age=0/iu.test(setCookie) || /expires=Thu, 01 Jan 1970/iu.test(setCookie);
        if (isExpired || value === "") jar.delete(name);
        else jar.set(name, value);
      }
    },
    size: () => jar.size,
  };
}

async function waitForServer(baseUrl, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/login`, { redirect: "manual" });
      if (response.status < 500) return;
      lastError = new Error(`GET /login returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Generated app did not become ready within ${timeoutMs / 1000}s: ${lastError}`);
}

async function main() {
  const overallStart = performance.now();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bw-generated-app-smoke-"));
  const fixtureDir = path.join(tempRoot, "smoke-platform");
  let stub = null;
  let appProcess = null;
  let serverOutput = "";

  try {
    // 1. Supabase stub -----------------------------------------------------
    stub = await startSupabaseStub({ log: verbose ? (line) => console.log(`  [stub] ${line}`) : () => {} });
    console.log(`[smoke] Supabase stub listening on ${stub.url}`);

    // 2. Generate the platform fixture (same shape as
    //    scripts/check-create-bw-app-templates.mjs: published dependency mode,
    //    then symlink the platform-preview node_modules into the fixture). ----
    await timed("generate fixture", () =>
      createBrightwebClientApp(
        {
          name: "smoke-platform",
          template: "platform",
          modules: SELECTABLE_MODULES.map(({ key }) => key).join(","),
          install: false,
          yes: true,
        },
        {
          banner: "Generated-app runtime smoke",
          dependencyMode: "published",
          targetDir: fixtureDir,
          workspaceRoot: repoRoot,
        },
      ));

    try {
      await fs.access(nextCli);
    } catch {
      throw new Error("Runtime smoke requires the workspace install. Run `pnpm install` first.");
    }
    await fs.symlink(
      previewNodeModules,
      path.join(fixtureDir, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );

    // 3. Runtime env pointed at the stub (NEXT_PUBLIC_* values are inlined at
    //    build time, so this must exist before `next build`). -----------------
    const appPort = await getFreePort();
    const appUrl = `http://127.0.0.1:${appPort}`;
    await fs.writeFile(
      path.join(fixtureDir, ".env.local"),
      [
        `NEXT_PUBLIC_APP_URL=${appUrl}`,
        `PUBLIC_APP_URL=${appUrl}`,
        `NEXT_PUBLIC_SUPABASE_URL=${stub.url}`,
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_smoke_test_key",
        "SUPABASE_SECRET_DEFAULT_KEY=sb_secret_smoke_test_key",
        "SUPABASE_KEEPALIVE_SECRET=smoke-keepalive-secret",
        "RESEND_API_KEY=re_smoke_test_key",
        "RESEND_WEBHOOK_SECRET=whsec_smoke_test",
        "RESEND_FROM_TRANSACTIONAL=noreply@example.com",
        "RESEND_FROM_MARKETING=news@example.com",
        "RESEND_FROM_EMAIL=noreply@example.com",
        "RESEND_FROM_NAME=Smoke",
        "MARKETING_FROM_EMAIL=news@example.com",
        "MARKETING_FROM_NAME=Smoke",
        "MARKETING_WORKER_SECRET=smoke-worker-secret",
        "CONTACT_TO_EMAIL=owner@example.com",
        "",
      ].join("\n"),
    );

    // 4. Production build + start -----------------------------------------
    // Keep the real Next typecheck enabled: a generated app that cannot pass
    // `next build` is not runtime-smoke ready.
    // --webpack for the same reason apps/platform-preview builds with it:
    // Turbopack refuses a node_modules symlink that points outside the
    // project root, which is exactly how this fixture (and the template
    // typecheck in scripts/check-create-bw-app-templates.mjs) is wired.
    await timed("next build", () =>
      runCommand("next build", process.execPath, [nextCli, "build", "--webpack"], { cwd: fixtureDir }));

    appProcess = spawn(process.execPath, [nextCli, "start", "-p", String(appPort)], {
      cwd: fixtureDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    });
    appProcess.stdout.setEncoding("utf8");
    appProcess.stderr.setEncoding("utf8");
    const captureServer = (chunk) => {
      serverOutput += chunk;
      if (verbose) process.stdout.write(chunk);
    };
    appProcess.stdout.on("data", captureServer);
    appProcess.stderr.on("data", captureServer);

    await timed("next start ready", () => waitForServer(appUrl));

    // 5. Unauthenticated contract ------------------------------------------
    console.log("[smoke] unauthenticated contract");
    const loginResponse = await fetch(`${appUrl}/login`, { redirect: "manual" });
    const loginHtml = await loginResponse.text();
    assert(loginResponse.status === 200, "GET /login responds 200");
    assert(loginHtml.includes("<html"), "GET /login returns an HTML document");

    for (const protectedPath of ["/dashboard", "/projetos", "/crm", "/admin/users", "/marketing"]) {
      const response = await fetch(`${appUrl}${protectedPath}`, { redirect: "manual" });
      const location = response.headers.get("location") ?? "";
      assert(
        response.status === 307 && new URL(location, appUrl).pathname === "/login",
        `unauthenticated GET ${protectedPath} redirects 307 to /login (got ${response.status} -> ${location || "none"})`,
      );
      await response.arrayBuffer();
    }

    const unauthorizedApi = await fetch(`${appUrl}/api/dashboard/projects`, { redirect: "manual" });
    const unauthorizedPayload = await unauthorizedApi.json();
    assert(unauthorizedApi.status === 401, "unauthenticated GET /api/dashboard/projects responds 401");
    assert(
      unauthorizedPayload?.error?.code === "ACCESS_DENIED",
      "401 payload carries the public error envelope { error: { code: \"ACCESS_DENIED\" } }",
    );
    const unauthorizedKeepalive = await fetch(`${appUrl}/api/cron/keepalive`);
    assert(unauthorizedKeepalive.status === 401, "keepalive rejects requests without its bearer secret");

    // 6. Real authenticated session ----------------------------------------
    // Sign in through @supabase/ssr's createServerClient with an in-memory
    // cookie jar, so the session cookies use the library's real chunked format
    // instead of a hand-forged one.
    console.log("[smoke] authenticated session");
    const infraRequire = createRequire(path.join(repoRoot, "packages", "infra", "package.json"));
    const { createServerClient } = infraRequire("@supabase/ssr");
    const jar = createCookieJar();
    const authClient = createServerClient(stub.url, "sb_publishable_smoke_test_key", {
      cookies: { getAll: jar.getAll, setAll: jar.setAll },
    });
    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email: USER_EMAIL,
      password: USER_PASSWORD,
    });
    assert(!signInError, `signInWithPassword succeeds against the stub (${signInError?.message ?? "ok"})`);
    assert(Boolean(signInData?.session?.access_token), "sign-in produced a session with an access token");
    assert(jar.size() > 0, "@supabase/ssr wrote session cookies into the jar");

    const authedFetch = async (pathname, init = {}) => {
      const response = await fetch(`${appUrl}${pathname}`, {
        redirect: "manual",
        ...init,
        headers: { cookie: jar.header(), ...(init.headers ?? {}) },
      });
      jar.absorbResponse(response);
      return response;
    };

    // 7. Authenticated page renders ----------------------------------------
    console.log("[smoke] authenticated page renders");
    // Markers must exist in the SSR payload (client components render their
    // initial state on the server): the viewer's name comes from the stub's
    // profiles table via the shell layout, "Website Redesign" is a fixture
    // project server-rendered by ProjectsServerMount, and "A carregar contactos"
    // is the deliberate CRM collection loading state rendered before hydration.
    const pageChecks = [
      { pathname: "/dashboard", marker: "Ana Silva" },
      { pathname: "/projetos", marker: "Website Redesign" },
      { pathname: "/crm", marker: "A carregar contactos" },
      { pathname: "/admin/users", marker: "Administração" },
      { pathname: "/marketing", marker: "Campanhas" },
    ];
    for (const { pathname, marker } of pageChecks) {
      const response = await authedFetch(pathname);
      const html = await response.text();
      assert(response.status === 200, `authenticated GET ${pathname} responds 200 (got ${response.status})`);
      if (!html.includes(marker)) {
        const dumpPath = path.join(os.tmpdir(), `bw-smoke${pathname.replaceAll("/", "-")}.html`);
        await fs.writeFile(dumpPath, html);
        throw new Error(
          `Assertion failed: authenticated ${pathname} HTML lacks sanity marker "${marker}" (HTML dumped to ${dumpPath})`,
        );
      }
      assert(true, `authenticated ${pathname} HTML contains sanity marker "${marker}"`);
      assert(!html.includes("Application error"), `authenticated ${pathname} HTML has no client-side crash banner`);
    }

    // 8. Dashboard API contract via the REAL app-shell parsers --------------
    console.log("[smoke] dashboard API contract");
    const parsers = await importDashboardParsers();
    const apiChecks = [
      { pathname: "/api/dashboard/projects", parse: parsers.parseDashboardProjectsResponse },
      { pathname: "/api/dashboard/crm", parse: parsers.parseDashboardCrmResponse },
      { pathname: "/api/dashboard/tasks", parse: parsers.parseDashboardTasksResponse },
    ];
    const parsedByPath = {};
    for (const { pathname, parse } of apiChecks) {
      const response = await authedFetch(pathname);
      assert(response.status === 200, `authenticated GET ${pathname} responds 200 (got ${response.status})`);
      const payload = await response.json();
      const { data, error } = parse(payload);
      assert(
        data !== null && error === null,
        `${pathname} payload satisfies the real app-shell parser (error: ${error ?? "none"})`,
      );
      parsedByPath[pathname] = data;
    }

    // 9. HEAD exact-count contract: the CRM "total contacts" KPI is derived
    //    from a `head:true` count whose only transport is the Content-Range
    //    header. If HEAD handling regressed, this number would be wrong. ------
    const crmData = parsedByPath["/api/dashboard/crm"];
    assert(
      crmData.kpis.crmTotalContacts === CRM_TOTAL_CONTACTS,
      `CRM KPI crmTotalContacts (${crmData.kpis.crmTotalContacts}) matches the fixture row count derived from HEAD Content-Range (${CRM_TOTAL_CONTACTS})`,
    );
    assert(
      (stub.stats.headRequestsByTable.get("crm_contacts") ?? 0) > 0,
      "the app issued HEAD count requests against crm_contacts",
    );

    // 10. Admin and Marketing runtime APIs plus reversible local mutations.
    console.log("[smoke] admin and marketing runtime mutations");
    const adminUsers = await authedFetch("/api/admin/users?page=1&pageSize=100");
    const adminUsersPayload = await adminUsers.json();
    assert(adminUsers.status === 200 && adminUsersPayload.data.length >= 2, "Admin users API lists fixture users");
    const invitations = await authedFetch("/api/admin/users/invitations");
    const invitationsPayload = await invitations.json();
    assert(invitations.status === 200 && Array.isArray(invitationsPayload.data), "Admin invitations API lists fixture invitations");

    const changeRole = async (newRole) => {
      const response = await authedFetch("/api/admin/users/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileIds: [SECOND_PROFILE_ID],
          newRole,
          reason: "Generated runtime smoke mutation.",
        }),
      });
      const payload = await response.json();
      assert(response.status === 200 && payload.summary.changed === 1, `Admin role mutation changes fixture user to ${newRole}`);
    };
    await changeRole("staff");
    const changedUsers = await (await authedFetch("/api/admin/users?page=1&pageSize=100")).json();
    assert(changedUsers.data.find((user) => user.profileId === SECOND_PROFILE_ID)?.role === "staff", "Admin role mutation is visible on a subsequent read");
    await changeRole("client");

    const topicsResponse = await authedFetch("/api/marketing/topics");
    const topics = await topicsResponse.json();
    assert(topicsResponse.status === 200 && topics.length > 0, "Marketing topics API lists fixture topics");
    const topicId = topics[0].id;
    const createCampaignResponse = await authedFetch("/api/marketing/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Smoke draft", subject: "Smoke subject", topicId }),
    });
    const createdCampaign = await createCampaignResponse.json();
    assert(createCampaignResponse.status === 201 && Boolean(createdCampaign.id), "Marketing API creates a local draft campaign");
    const updateCampaignResponse = await authedFetch(`/api/marketing/campaigns/${createdCampaign.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject: "Updated smoke subject" }),
    });
    const updatedCampaign = await updateCampaignResponse.json();
    assert(updateCampaignResponse.status === 200 && updatedCampaign.subject === "Updated smoke subject", "Marketing API updates the draft campaign");
    const campaignRead = await authedFetch(`/api/marketing/campaigns/${createdCampaign.id}`);
    assert(campaignRead.status === 200, "Marketing API reads the mutated draft campaign");
    const campaignDelete = await authedFetch(`/api/marketing/campaigns/${createdCampaign.id}`, { method: "DELETE" });
    const campaignDeletePayload = await campaignDelete.json();
    assert(
      campaignDelete.status === 200 && campaignDeletePayload.data?.deletedId === createdCampaign.id,
      "Marketing API deletes the local draft campaign",
    );
    const deletedCampaignRead = await authedFetch(`/api/marketing/campaigns/${createdCampaign.id}`);
    assert(deletedCampaignRead.status === 404, "deleted Marketing draft is absent on a subsequent read");

    const keepalive = await fetch(`${appUrl}/api/cron/keepalive`, {
      headers: { authorization: "Bearer smoke-keepalive-secret" },
    });
    const keepalivePayload = await keepalive.json();
    assert(keepalive.status === 200 && keepalivePayload.metrics.profiles === 2, "authorized keepalive reaches the database count query");

    const totalSeconds = (performance.now() - overallStart) / 1_000;
    console.log(`\n[smoke] PASS - ${assertionCount} assertions in ${totalSeconds.toFixed(1)}s`);
    if (stub.stats.unhandled.length > 0) {
      const unique = [...new Set(stub.stats.unhandled)];
      console.log(`[smoke] note: ${unique.length} unhandled stub route(s) were tolerated:`);
      for (const route of unique) console.log(`  - ${route}`);
    }
  } catch (error) {
    console.error("\n[smoke] FAIL");
    console.error(error);
    if (serverOutput) {
      const tail = serverOutput.split("\n").slice(-60).join("\n");
      console.error("[smoke] next start output (tail):\n" + tail);
    }
    if (stub && stub.stats.unhandled.length > 0) {
      const unique = [...new Set(stub.stats.unhandled)];
      console.error(`[smoke] unhandled stub routes (likely contract gaps):`);
      for (const route of unique) console.error(`  - ${route}`);
    }
    process.exitCode = 1;
  } finally {
    if (appProcess && appProcess.exitCode === null) {
      appProcess.kill("SIGTERM");
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          appProcess.kill("SIGKILL");
          resolve();
        }, 5_000);
        appProcess.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    if (stub) await stub.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
