import path from "node:path";
import { stdout as output } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { loadAppEnvironment, readFirstEnvironmentValue } from "./env.mjs";

const HELP = `Usage: bw admin create --email <email> [options]

Options:
  --email <email>          Email address for the first administrator
  --target-dir <path>      App directory (defaults to cwd)
  --dry-run                Validate and inspect without creating the user
  --help                   Show this help

The command never accepts or prompts for a password. It sends the user through
the scaffolded core-auth /reset-password recovery flow.`;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveAdminEnvironment(environment) {
  const supabaseUrl = readFirstEnvironmentValue(environment, ["NEXT_PUBLIC_SUPABASE_URL"]);
  const secretKey = readFirstEnvironmentValue(environment, [
    "SUPABASE_SECRET_DEFAULT_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  const appUrl = readFirstEnvironmentValue(environment, [
    "NEXT_PUBLIC_APP_URL",
    "PUBLIC_APP_URL",
  ]);

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in the process environment or .env.local.");
  }
  if (!secretKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_DEFAULT_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) in the process environment or .env.local.",
    );
  }
  if (!secretKey.startsWith("sb_secret_")) {
    throw new Error(
      "Invalid Supabase secret: SUPABASE_SECRET_DEFAULT_KEY must use an sb_secret_ key.",
    );
  }
  if (!appUrl) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL in the process environment or .env.local.");
  }

  let resetPasswordUrl;
  try {
    resetPasswordUrl = new URL("/reset-password", appUrl).toString();
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be an absolute URL.");
  }

  return { supabaseUrl, secretKey, resetPasswordUrl };
}

async function findAuthUserByEmail(supabase, email) {
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Could not inspect Supabase Auth users: ${error.message}`);
    const match = data.users.find((user) => normalizeEmail(user.email) === email);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
}

async function projectHasAdmin(supabase) {
  const { data, error } = await supabase
    .from("user_role_assignments")
    .select("profile_id")
    .eq("role_code", "admin")
    .limit(1);
  if (error) {
    throw new Error(
      `Could not inspect administrator assignments: ${error.message}. Apply the generated Supabase migrations first.`,
    );
  }
  return Array.isArray(data) && data.length > 0;
}

async function deleteCreatedAuthUser(supabase, userId) {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  return error || null;
}

function bootstrapErrorMessage(error) {
  const message = error?.message || "Unknown database error";
  if (message.toLowerCase().includes("administrator already exists")) {
    return "A project administrator already exists. Use the in-app admin role controls to add administrators.";
  }
  return `Could not create the administrator profile and role: ${message}`;
}

export async function createFirstAdmin(action, argvOptions = {}, runtimeOptions = {}) {
  if (argvOptions.help) {
    (runtimeOptions.output || output).write(`${HELP}\n`);
    return { help: true };
  }
  if (action !== "create") {
    throw new Error(`Unknown admin command: ${action || "(missing)"}\n\n${HELP}`);
  }
  if ("password" in argvOptions) {
    throw new Error("Passwords are not accepted by bw admin create. The command sends a password-set email instead.");
  }
  if ("force" in argvOptions) {
    throw new Error("--force has been removed; use the in-app admin role controls to add administrators.");
  }

  const email = normalizeEmail(argvOptions.email);
  if (!validateEmail(email)) {
    throw new Error("A valid --email <email> is required.");
  }

  const targetDir = path.resolve(runtimeOptions.targetDir || argvOptions.targetDir || process.cwd());
  const environment = await loadAppEnvironment(targetDir, runtimeOptions.env || process.env);
  const { supabaseUrl, secretKey, resetPasswordUrl } = resolveAdminEnvironment(environment);
  const clientFactory = runtimeOptions.createClient || createClient;
  const supabase = clientFactory(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const hasAdmin = await projectHasAdmin(supabase);
  if (hasAdmin) {
    throw new Error(
      "A project administrator already exists. Refusing bootstrap; use the in-app admin role controls to add administrators.",
    );
  }

  const existingUser = await findAuthUserByEmail(supabase, email);
  if (existingUser) {
    throw new Error(
      `Auth user ${email} already exists (${existingUser.id}). Refusing to promote an existing account; use the in-app admin role controls.`,
    );
  }

  if (argvOptions.dryRun) {
    (runtimeOptions.output || output).write(
      `DRY RUN ${email} can be created as the first administrator.\n`,
    );
    return { dryRun: true, email };
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError || !created.user?.id) {
    throw new Error(`Could not create Supabase Auth user ${email}: ${createError?.message || "missing user id"}`);
  }

  const userId = created.user.id;
  let profileId = null;
  try {
    const { data: bootstrapRows, error: bootstrapError } = await supabase.rpc(
      "bootstrap_first_admin",
      {
        p_user_id: userId,
        p_email: email,
      },
    );
    if (bootstrapError) throw new Error(bootstrapErrorMessage(bootstrapError));
    profileId = Array.isArray(bootstrapRows) ? bootstrapRows[0]?.profile_id ?? null : null;
    if (!profileId) throw new Error("The bootstrap transaction did not return a profile id.");

    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetPasswordUrl,
    });
    if (recoveryError) {
      throw new Error(`Could not send the password-set email: ${recoveryError.message}`);
    }
  } catch (error) {
    const rollbackError = await deleteCreatedAuthUser(supabase, userId);
    const message = error instanceof Error ? error.message : "Unknown bootstrap error";
    if (rollbackError) {
      throw new Error(
        `${message} Automatic rollback also failed: ${rollbackError.message}. Auth user ${userId} may require manual cleanup.`,
      );
    }
    throw new Error(`${message} The newly created Auth user and its cascaded profile/role were rolled back.`);
  }

  (runtimeOptions.output || output).write(
    `Created administrator ${email}. A password-set link was sent for ${resetPasswordUrl}.\n`,
  );
  return {
    email,
    userId,
    profileId,
    resetPasswordUrl,
  };
}

export { HELP as ADMIN_HELP };
