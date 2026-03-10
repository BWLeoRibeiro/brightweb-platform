import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Variáveis de ambiente do Supabase em falta.");
}

if (supabaseAnonKey.startsWith("sb_secret_") || supabaseAnonKey.includes("service_role")) {
  throw new Error(
    "Chave Supabase inválida: está a usar uma chave service role (secreta) em NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Use a chave anon/pública do painel do Supabase (Settings > API > anon public key). " +
      "A chave anon deve começar por 'eyJ' (é um token JWT).",
  );
}

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

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
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

export function createServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
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
