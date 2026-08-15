import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workdir = path.join(rootDir, "supabase", ".generated", "brightweb-platform");
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/with-local-preview-supabase.mjs <command> [...args]");
  process.exit(1);
}

const statusResult = spawnSync(
  "supabase",
  ["status", "--workdir", workdir, "-o", "json"],
  { cwd: rootDir, encoding: "utf8" },
);

if (statusResult.status !== 0) {
  process.stderr.write(statusResult.stderr || "Local Supabase is not running. Run pnpm db:local:start first.\n");
  process.exit(statusResult.status ?? 1);
}

const local = JSON.parse(statusResult.stdout);
const localSecretKey = local.SECRET_KEY;
if (typeof localSecretKey !== "string" || !localSecretKey.startsWith("sb_secret_")) {
  console.error("Local Supabase did not provide an sb_secret_ key. Update the Supabase CLI and restart the local stack.");
  process.exit(1);
}

const child = spawn(command, args, {
  cwd: rootDir,
  env: {
    ...process.env,
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: local.ANON_KEY,
    SUPABASE_SECRET_DEFAULT_KEY: localSecretKey,
    NEXT_PUBLIC_ENABLE_CRM: "true",
    NEXT_PUBLIC_ENABLE_PROJECTS: "true",
    NEXT_PUBLIC_ENABLE_ADMIN: "true",
    RESEND_API_KEY: "",
    RESEND_FROM_TRANSACTIONAL: "",
    RESEND_FROM_MARKETING: "",
    CONTACT_TO_EMAIL: "",
    RESEND_WEBHOOK_SECRET: "",
    MARKETING_WORKER_SECRET: "",
    MARKETING_TEST_EMAIL: "",
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error(`Could not start ${command}: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
