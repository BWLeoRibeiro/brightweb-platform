"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@brightweblabs/ui/button";
import { Field, FieldContent, FieldLabel } from "@brightweblabs/ui/field";
import { Input } from "@brightweblabs/ui/input";
import { PasswordInput } from "@brightweblabs/ui/password-input";
import { AUTH_RESEND_COOLDOWN_SECONDS, validateEmail } from "../shared";
import { useCooldownTimer } from "../client";
import { AuthCard, AuthDivider, AuthHeading, AuthLayout, AuthNotice } from "./auth-layout";
import { useAuthUi } from "./context";

function buildPostLoginPath(invitationId: string | null, redirectTo: string | null) {
  const params = new URLSearchParams();
  if (invitationId) params.set("invitationId", invitationId);
  if (redirectTo) params.set("next", redirectTo);
  const query = params.toString();
  return query ? `/auth/post-login?${query}` : "/auth/post-login";
}

function buildBrowserCallbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { client, dictionary } = useAuthUi();
  const d = dictionary.login;
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const redirectInFlightRef = useRef(false);
  const invitationId = searchParams.get("invite");
  const redirectTo = searchParams.get("redirectTo");
  const shouldRecoverStaleSession = searchParams.get("error") === "session_reset";
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState(searchParams.get("email")?.trim().toLowerCase() ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(searchParams.get("error") === "auth_failed");
  const [resendLoading, setResendLoading] = useState(false);
  const { remaining, isCoolingDown, start } = useCooldownTimer(AUTH_RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    const message = searchParams.get("message");
    const errorCode = searchParams.get("error");
    if (searchParams.get("confirmed") === "1") setInfo(d.confirmed);
    else if (message === "password-updated") setInfo(d.passwordUpdated);
    else if (message === "invite-only") setInfo(d.inviteOnlyMessage);
    else if (message === "invite-accepted") setInfo(d.inviteAccepted);
    else if (errorCode === "auth_system") setError(d.authSystemError);
    else if (errorCode === "auth_failed") setError(`${d.authFailed} ${d.resendPrompt}`);
    else if (errorCode === "session_reset") setError(d.sessionReset);
  }, [d, searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function prepare() {
      try {
        if (shouldRecoverStaleSession) await client.signOutLocal();
        const { user } = await client.getSession();
        if (!cancelled && user && !redirectInFlightRef.current) {
          redirectInFlightRef.current = true;
          setRedirecting(true);
          router.replace(buildPostLoginPath(invitationId, redirectTo));
        }
      } catch {
        if (!cancelled) setError(d.authSystemError);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void prepare();
    return () => { cancelled = true; };
  }, [client, d.authSystemError, invitationId, redirectTo, router, shouldRecoverStaleSession]);

  useEffect(() => {
    if (error && mode === "password") passwordInputRef.current?.focus();
  }, [error, mode]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (!validateEmail(normalizedEmail)) throw new Error("invalid-email");
      if (mode === "magic") {
        await client.sendMagicLink({ email: normalizedEmail, redirectTo: buildBrowserCallbackUrl() });
        setInfo(d.magicSent);
        return;
      }
      await client.signInWithPassword({ email: normalizedEmail, password });
      redirectInFlightRef.current = true;
      setRedirecting(true);
      router.replace(buildPostLoginPath(invitationId, redirectTo));
    } catch (authError) {
      const code = (authError as { code?: string } | null)?.code ?? "";
      const message = ((authError as { message?: string } | null)?.message ?? "").toLowerCase();
      if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
        setError(d.unconfirmed);
        setShowResend(true);
      } else {
        setError(mode === "magic" ? d.resendError : d.invalid);
        setShowResend(false);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendLoading || isCoolingDown) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!validateEmail(normalizedEmail)) {
      setError(d.invalid);
      return;
    }
    setResendLoading(true);
    try {
      await client.resendConfirmation({ email: normalizedEmail, redirectTo: buildBrowserCallbackUrl() });
      setInfo(d.resendSuccess);
      setError(null);
      start();
    } catch {
      setError(d.resendError);
    } finally {
      setResendLoading(false);
    }
  }

  if (checking || redirecting) {
    return (
      <AuthLayout>
        <AuthCard><p className="paragraph-mini text-center text-muted-foreground">{redirecting ? d.redirecting : dictionary.common.loading}</p></AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeading title={d.title} description={mode === "magic" ? d.magicDescription : d.description} />
        <AuthDivider />
        {error ? (
          <AuthNotice id="login-error">
            {error}
            {showResend ? (
              <span className="mt-3 flex items-center justify-between gap-3 border-t border-current/20 pt-3">
                <span>{d.resendPrompt}</span>
                <button type="button" onClick={handleResend} disabled={resendLoading || isCoolingDown} className="rounded px-1 font-semibold underline underline-offset-4 transition-colors hover:bg-current/10">
                  {resendLoading ? d.resending : isCoolingDown ? d.resendCooldown(remaining) : d.resend}
                </button>
              </span>
            ) : null}
          </AuthNotice>
        ) : null}
        {info ? <AuthNotice tone="success">{info}</AuthNotice> : null}
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <Field>
            <FieldLabel htmlFor="email" className="mb-1.5 block paragraph-small font-semibold text-foreground/60">{dictionary.common.email}</FieldLabel>
            <FieldContent>
              <Input id="email" type="email" placeholder={dictionary.common.emailPlaceholder} value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} autoComplete="email" />
            </FieldContent>
          </Field>
          {mode === "password" ? (
            <Field>
              <div className="mb-1.5 flex items-center justify-between">
                <FieldLabel htmlFor="password" className="block paragraph-small font-semibold text-foreground/60">{dictionary.common.password}</FieldLabel>
                <Button variant="link" size="link" asChild><Link href="/forgot-password" className="paragraph-mini text-primary hover:text-primary/80">{d.forgot}</Link></Button>
              </div>
              <FieldContent>
                <PasswordInput ref={passwordInputRef} id="password" placeholder={dictionary.common.passwordPlaceholder} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} autoComplete="current-password" aria-describedby={error ? "login-error" : undefined} aria-invalid={!!error} showPasswordLabel={dictionary.common.showPassword} hidePasswordLabel={dictionary.common.hidePassword} />
              </FieldContent>
            </Field>
          ) : null}
          <Button type="submit" className="h-11 w-full rounded-full" disabled={loading}>
            {loading ? (mode === "magic" ? d.magicSubmitting : d.submitting) : (mode === "magic" ? d.magicSubmit : d.submit)}
          </Button>
        </form>
        <Button type="button" variant="link" size="link" onClick={() => { setMode(mode === "password" ? "magic" : "password"); setError(null); setInfo(null); }} className="mx-auto paragraph-mini text-foreground/60">
          {mode === "password" ? d.magicLink : d.passwordMode}
        </Button>
        <p className="pt-1 text-center paragraph-mini text-foreground-muted-accessible">{d.inviteOnly}</p>
      </AuthCard>
    </AuthLayout>
  );
}

export function LoginPage() {
  const { dictionary } = useAuthUi();
  return (
    <Suspense fallback={<AuthLayout><AuthCard><p className="paragraph-mini text-center text-muted-foreground">{dictionary.common.loading}</p></AuthCard></AuthLayout>}>
      <LoginPageContent />
    </Suspense>
  );
}
