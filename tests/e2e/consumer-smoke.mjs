// Acceptance against an existing consumer's installed dependencies and real
// disposable Supabase. No consumer configuration or environment file is edited.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { startConsumerBackend } from "./consumer-backend.mjs";
import { runCriticalWorkflowsBrowser, runLoginAndTaskBrowser, runWorkflowBrowser, runInvitationBrowser } from "./critical-workflows-browser.mjs";

const arg = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const consumerRoot = path.resolve(arg("--consumer-root") ?? ".");
const migrationsDirectory = arg("--migrations-directory");
const consumerChecksPath = arg("--consumer-checks");
assert(!process.argv.includes("--consumer-checks") || (consumerChecksPath && path.isAbsolute(consumerChecksPath)), "--consumer-checks requires an absolute trusted module path");
const consumerChecks = consumerChecksPath ? await import(pathToFileURL(consumerChecksPath).href) : null;
assert(!consumerChecks || typeof consumerChecks.runConsumerChecks === "function", "--consumer-checks must export runConsumerChecks(context)");
const contextSetupPath = arg("--context-setup");
assert(!process.argv.includes("--context-setup") || (contextSetupPath && path.isAbsolute(contextSetupPath)), "--context-setup requires an absolute trusted module path");
const setupContext = contextSetupPath
  ? (await import(pathToFileURL(path.resolve(contextSetupPath)).href)).setupContext
  : consumerChecks?.setupContext ?? (async () => {});
assert.equal(typeof setupContext, "function", "Browser setup hook must export setupContext(context)");
assert(migrationsDirectory, "--migrations-directory is required (explicit assembled client migrations)");
const require = createRequire(path.join(consumerRoot, "package.json"));
const next = require.resolve("next/dist/bin/next");
const socket = createServer();
await new Promise(resolve => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
// NextURL canonicalizes loopback IPs to localhost; keep browser cookies on that origin.
const appUrl = `http://localhost:${port}`;
let backend, app;
async function command(args, env) {
  await new Promise((resolve, reject) => {
    // Acceptance must exercise the already-installed candidate. Newer pnpm
    // versions otherwise reconcile dependencies before running the build.
    const child = spawn("pnpm", ["--config.verify-deps-before-run=false", "run", "build"], { cwd: consumerRoot, env, stdio: "inherit", detached: process.platform !== "win32" });
    const terminate = signal => {
      try { if (process.platform === "win32") child.kill(signal); else process.kill(-child.pid, signal); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    };
    let timedOut = false;
    let forceKill;
    const timeout = setTimeout(() => {
      timedOut = true;
      terminate("SIGTERM");
      forceKill = setTimeout(() => terminate("SIGKILL"), 5000);
    }, 240_000);
    const clearTimers = () => { clearTimeout(timeout); clearTimeout(forceKill); };
    child.once("error", error => { clearTimers(); reject(error); });
    child.once("exit", code => {
      clearTimers();
      if (timedOut) reject(new Error(`Next ${args[0]} exceeded 240 seconds`));
      else if (code === 0) resolve();
      else reject(new Error(`Next ${args[0]} failed (${code})`));
    });
  });
}
try {
  backend = await startConsumerBackend({ migrationsDirectory: path.resolve(migrationsDirectory), appUrl });
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_APP_URL: appUrl, PUBLIC_APP_URL: appUrl,
    NEXT_PUBLIC_SUPABASE_URL: backend.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: backend.publishableKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: backend.anonKey, SUPABASE_SECRET_DEFAULT_KEY: backend.secretKey,
    SUPABASE_SERVICE_ROLE_KEY: backend.serviceKey };
  await command(["build"], env);
  app = spawn(process.execPath, [next, "start", "--hostname", "127.0.0.1", "-p", String(port)], { cwd: consumerRoot, env, stdio: "inherit" });
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (app.exitCode !== null) throw new Error("Consumer exited before becoming ready");
    try {
      const response = await fetch(`${appUrl}/login`, { signal: AbortSignal.timeout(2000) });
      // A streamed page is ready only after its body completes; abandoning it
      // here lets the request timeout close an otherwise healthy server stream.
      await response.arrayBuffer();
      if (response.status === 200) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(ready, "Consumer production build must serve login within 60 seconds");
  const user = await backend.createUser({ email: "browser-admin@example.invalid", password: "Browser-test-only-2026!" });
  const project = await backend.createProject({ profileId: user.profileId });
  const cookies = await runLoginAndTaskBrowser({ appUrl, additionalOrigins: [backend.url], credentials: user, ...project, setupContext, projectsPath: arg("--projects-path") ?? "/projetos" });
  await runCriticalWorkflowsBrowser({ appUrl, additionalOrigins: [backend.url], cookies, setupContext, marketingPath: arg("--marketing-path") ?? "/marketing" });
  await runWorkflowBrowser({ appUrl, additionalOrigins: [backend.url], topicId: backend.topicId, cookies, setupContext, marketingPath: arg("--marketing-path") ?? "/marketing" });
  const invitedUser = await backend.createUser({ email: "browser-invited@example.invalid", password: "Browser-test-only-2026!", role: "client" });
  const delivery = await backend.sendMagicLink({ email: invitedUser.email });
  assert.equal(delivery.delivered, true, "Auth mail must reach the local synthetic sink");
  const invitation = await backend.createInvitation({ email: invitedUser.email, inviterProfileId: user.profileId });
  await runInvitationBrowser({ appUrl, additionalOrigins: [backend.url], cookies, invitation, invitedUser, setupContext });
  if (consumerChecks) await consumerChecks.runConsumerChecks({ consumerRoot, appUrl, backend, cookies, user, project, invitedUser, invitation, setupContext });
  console.log("[consumer] PASS installed consumer: production build, real login, task persistence and campaign recovery");
} finally {
  if (app && app.exitCode === null) {
    app.kill("SIGTERM");
    await new Promise(resolve => { const timeout = setTimeout(() => { app.kill("SIGKILL"); resolve(); }, 5000); app.once("exit", () => { clearTimeout(timeout); resolve(); }); });
  }
  if (backend) await backend.stop();
}
