import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@brightweblabs/infra/server";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "recovery", "invite", "magiclink", "email_change", "email"]);

function isEmailOtpType(value: string): value is EmailOtpType {
  return OTP_TYPES.has(value as EmailOtpType);
}

function isRecoverableAuthLinkError(error: string | null): boolean {
  const normalized = (error ?? "").toLowerCase();
  return ["expired", "invalid", "already", "used", "otp", "token", "code verifier", "code_verifier", "pkce", "flow state", "flow_state"]
    .some((fragment) => normalized.includes(fragment));
}

function isSystemAuthError(error: string | null, status: number | null): boolean {
  if (typeof status === "number" && status >= 500) return true;
  const normalized = (error ?? "").toLowerCase();
  return ["network", "fetch", "timeout", "internal server error"].some((fragment) => normalized.includes(fragment));
}

export async function handleAuthCallbackRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const typeParam = requestUrl.searchParams.get("type");
  const origin = requestUrl.origin;
  const next = requestUrl.searchParams.get("next") ?? "/auth/post-login";
  const nextUrl = `${origin}${next.startsWith("/") ? next : "/auth/post-login"}`;
  const confirmedLoginUrl = `${origin}/auth/confirmed?target=login`;

  if (!code && !tokenHash) return NextResponse.redirect(confirmedLoginUrl);

  try {
    const supabase = await createServerSupabase();
    let hasSession = false;
    let authError: string | null = null;
    let authStatus: number | null = null;

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      hasSession = Boolean(data.session);
      authError = error?.message ?? null;
      authStatus = error?.status ?? null;
    } else if (tokenHash && typeParam && isEmailOtpType(typeParam)) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: typeParam });
      hasSession = Boolean(data.session);
      authError = error?.message ?? null;
      authStatus = error?.status ?? null;
    } else if (tokenHash && typeParam) {
      authError = "Tipo de callback inválido";
    } else {
      authError = "Parâmetros obrigatórios do callback de autenticação em falta";
    }

    if (hasSession) return NextResponse.redirect(nextUrl);
    if (!typeParam && tokenHash && !code) return NextResponse.redirect(confirmedLoginUrl);
    if (isSystemAuthError(authError, authStatus)) return NextResponse.redirect(`${origin}/login?error=auth_system`);
    if (isRecoverableAuthLinkError(authError)) return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=auth_system`);
  }
}

function shouldClearCookie(name: string) {
  return name.startsWith("sb-") || name.includes("supabase") || name.includes("auth-token");
}

export async function handleAuthCleanupRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const next = requestUrl.searchParams.get("next") ?? "/login?error=session_reset";
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (shouldClearCookie(cookie.name)) cookieStore.delete(cookie.name);
  }
  return NextResponse.redirect(`${requestUrl.origin}${next.startsWith("/") ? next : "/login?error=session_reset"}`);
}
