import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { resolveSupabasePublicEnv, resolveSupabaseServiceRoleKey, resolveSupabaseUrl } from "./supabase-env";

const RESEND_API_BASE = "https://api.resend.com";

export class ResendConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResendConfigError";
  }
}

export class ResendApiError extends Error {
  status: number;
  body: unknown;
  path: string;

  constructor(message: string, params: { status: number; body: unknown; path: string }) {
    super(message);
    this.name = "ResendApiError";
    this.status = params.status;
    this.body = params.body;
    this.path = params.path;
  }
}

function getEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ResendConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function compareSecret(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type ServerSupabaseDependencies = {
  resolvePublicEnv: typeof resolveSupabasePublicEnv;
  getCookies: typeof cookies;
  createServerClient: typeof createServerClient;
};

const defaultServerSupabaseDependencies: ServerSupabaseDependencies = {
  resolvePublicEnv: resolveSupabasePublicEnv,
  getCookies: cookies,
  createServerClient,
};

export async function createServerSupabase(
  dependencies: ServerSupabaseDependencies = defaultServerSupabaseDependencies,
) {
  const { supabaseUrl, supabasePublishableKey } = dependencies.resolvePublicEnv();
  const cookieStore = await dependencies.getCookies();

  return dependencies.createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Ignore set failures from read-only server contexts.
        }
      },
    },
  });
}

export type ServiceRoleClientDependencies = {
  resolveUrl: typeof resolveSupabaseUrl;
  resolveServiceRoleKey: typeof resolveSupabaseServiceRoleKey;
  createClient: typeof createClient;
};

const defaultServiceRoleClientDependencies: ServiceRoleClientDependencies = {
  resolveUrl: resolveSupabaseUrl,
  resolveServiceRoleKey: resolveSupabaseServiceRoleKey,
  createClient,
};

export function createServiceRoleClient(
  dependencies: ServiceRoleClientDependencies = defaultServiceRoleClientDependencies,
) {
  const supabaseUrl = dependencies.resolveUrl();
  const serviceRoleKey = dependencies.resolveServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return dependencies.createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function requireServiceRoleClient() {
  const client = createServiceRoleClient();
  if (!client) {
    throw new Error("Cliente de service role indisponível.");
  }
  return client;
}

export function getResendApiKey(): string {
  return getEnv("RESEND_API_KEY");
}

export function getTransactionalSender(): string {
  return getEnv("RESEND_FROM_TRANSACTIONAL");
}

export function getMarketingSender(): string {
  return getEnv("RESEND_FROM_MARKETING");
}

export function getContactDestination(): string {
  return getEnv("CONTACT_TO_EMAIL");
}

export function getResendWebhookSecret(): string {
  return getEnv("RESEND_WEBHOOK_SECRET");
}

export function verifyResendWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret?: string,
): boolean {
  if (!signatureHeader) return false;
  const header = signatureHeader.trim();
  if (!header) return false;

  const resolvedSecret = secret?.trim() || getResendWebhookSecret();

  if (header.startsWith("sha256=")) {
    const signature = header.slice("sha256=".length).trim();
    if (!signature) return false;
    const digest = createHmac("sha256", resolvedSecret).update(rawBody).digest("hex");
    return compareSecret(digest, signature);
  }

  return compareSecret(resolvedSecret, header);
}

export async function resendApiRequest<TResponse>(
  path: string,
  init: Omit<RequestInit, "headers"> & {
    headers?: Record<string, string>;
  } = {},
): Promise<TResponse> {
  const apiKey = getResendApiKey();
  const response = await fetch(`${RESEND_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    console.error("Resend API request failed", {
      path,
      status: response.status,
      body: data,
    });
    throw new ResendApiError(`Resend API error (${response.status})`, {
      status: response.status,
      body: data,
      path,
    });
  }

  return data as TResponse;
}

/**
 * Keepalive endpoint for scheduler-driven database pings.
 *
 * Free-tier Supabase projects pause after roughly seven days without activity,
 * which takes the whole app down until someone resumes them by hand. Mount this
 * as a GET route and have a scheduler call it a couple of times a day with
 * `Authorization: Bearer $SUPABASE_KEEPALIVE_SECRET`. The count query is
 * deliberate — an HTTP request that never reaches Postgres does not reset the
 * inactivity timer.
 */
export async function handleKeepaliveGetRequest(request: Request): Promise<Response> {
  const expectedSecret = process.env.SUPABASE_KEEPALIVE_SECRET?.trim();
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!expectedSecret || !compareSecret(`Bearer ${expectedSecret}`, authorization)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "Supabase environment is not configured" },
      { status: 500 },
    );
  }

  const startedAt = Date.now();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    metrics: { profiles: count },
    durationMs: Date.now() - startedAt,
  });
}
