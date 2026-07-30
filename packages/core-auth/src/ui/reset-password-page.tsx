"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@brightweblabs/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@brightweblabs/ui/field";
import { PasswordInput } from "@brightweblabs/ui/password-input";
import { PasswordStrength } from "@brightweblabs/ui/password-strength";
import { validatePassword } from "../shared";
import {
  AuthCard,
  AuthDivider,
  AuthHeading,
  AuthLayout,
  AuthLoadingState,
  AuthNotice,
  AuthStateMark,
} from "./auth-layout";
import { useAuthUi } from "./context";
import type { AuthUiClient } from "./types";

type RecoveryPreparation = {
  error: string | null;
  replacementPath: string | null;
};

function cleanRecoveryUrl(currentUrl: URL) {
  for (const key of ["code", "type", "error", "error_code", "error_description"]) {
    currentUrl.searchParams.delete(key);
  }
  currentUrl.hash = "";
  return `${currentUrl.pathname}${currentUrl.search}`;
}

export async function prepareRecoveryUrl(
  currentUrl: URL,
  client: Pick<AuthUiClient, "establishRecoverySession" | "exchangeRecoveryCode"> & Partial<Pick<AuthUiClient, "getSession">>,
  invalidLink: string,
): Promise<RecoveryPreparation> {
  const fragment = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
  const authError = currentUrl.searchParams.get("error")
    ?? currentUrl.searchParams.get("error_description")
    ?? fragment.get("error")
    ?? fragment.get("error_description");

  if (authError) {
    return {
      error: invalidLink,
      replacementPath: cleanRecoveryUrl(currentUrl),
    };
  }

  const code = currentUrl.searchParams.get("code");
  if (code) {
    await client.exchangeRecoveryCode(code);
    return {
      error: null,
      replacementPath: cleanRecoveryUrl(currentUrl),
    };
  }

  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (fragment.get("type") === "recovery" && accessToken && refreshToken) {
    await client.establishRecoverySession({ accessToken, refreshToken });
    return {
      error: null,
      replacementPath: cleanRecoveryUrl(currentUrl),
    };
  }

  if (client.getSession) {
    const session = await client.getSession();
    if (session.user) return { error: null, replacementPath: null };
  }

  return { error: invalidLink, replacementPath: null };
}

export function ResetPasswordPage() {
  const router = useRouter();
  const { client, dictionary } = useAuthUi();
  const d = dictionary.reset;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [invalidRecovery, setInvalidRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function prepareRecovery() {
      const currentUrl = new URL(window.location.href);
      try {
        const result = await prepareRecoveryUrl(currentUrl, client, d.invalidLink);
        if (!mounted) return;
        if (result.error) {
          setError(result.error);
          setInvalidRecovery(true);
        }
        if (result.replacementPath) router.replace(result.replacementPath);
      } catch {
        if (mounted) {
          setError(d.invalidLink);
          setInvalidRecovery(true);
        }
      } finally {
        if (mounted) setPreparing(false);
      }
    }
    void prepareRecovery();
    return () => { mounted = false; };
  }, [client, d.invalidLink, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    if (password !== confirmPassword) {
      setConfirmPasswordError(d.mismatch);
      setLoading(false);
      return;
    }
    const validation = validatePassword(password);
    if (!validation.isValid) {
      setPasswordError(validation.errors.join(". "));
      setLoading(false);
      return;
    }
    try {
      await client.resetPassword(password);
      router.push("/login?message=password-updated");
    } catch (caught) {
      setError((caught as Error)?.message === "missing-session" ? d.invalidLink : d.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard>
        {preparing ? <AuthLoadingState label={d.preparing} /> : invalidRecovery ? (
          <div className="auth-state-panel">
            <AuthStateMark tone="warning" />
            <AuthHeading title={d.invalidTitle ?? d.title} description={d.invalidLink} />
            <Button asChild className="h-11 w-full">
              <Link href="/forgot-password">{d.requestNewLink ?? dictionary.common.backToLogin}</Link>
            </Button>
            <Button variant="link" size="link" asChild>
              <Link href="/login" className="mx-auto text-meta auth-paragraph-mini text-foreground-muted-accessible hover:text-foreground">{dictionary.common.backToLogin}</Link>
            </Button>
          </div>
        ) : (
          <>
            <AuthHeading title={d.title} description={d.description} />
            <AuthDivider />
            {error ? <AuthNotice id="reset-password-error">{error}</AuthNotice> : null}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5" aria-busy={loading}>
              <Field data-invalid={Boolean(passwordError)}>
                <FieldLabel htmlFor="password" className="mb-1.5 block text-body auth-paragraph-small font-semibold text-foreground-muted-accessible">{dictionary.common.newPassword}</FieldLabel>
                <FieldContent>
                  <PasswordInput id="password" name="password" placeholder={dictionary.common.passwordPlaceholder} value={password} onChange={(event) => { setPassword(event.target.value); setPasswordError(null); }} required minLength={8} autoComplete="new-password" aria-describedby={passwordError ? "reset-password-field-error" : "password-description"} aria-invalid={Boolean(passwordError)} showPasswordLabel={dictionary.common.showPassword} hidePasswordLabel={dictionary.common.hidePassword} />
                  {password ? <PasswordStrength password={password} labels={dictionary.common.passwordStrength} className="mt-2" /> : null}
                  <FieldDescription id="password-description" className="mt-1.5 text-meta auth-paragraph-mini text-foreground-muted-accessible">{d.passwordHint}</FieldDescription>
                  <FieldError id="reset-password-field-error">{passwordError}</FieldError>
                </FieldContent>
              </Field>
              <Field data-invalid={Boolean(confirmPasswordError)}>
                <FieldLabel htmlFor="confirmPassword" className="mb-1.5 block text-body auth-paragraph-small font-semibold text-foreground-muted-accessible">{dictionary.common.confirmPassword}</FieldLabel>
                <FieldContent>
                  <PasswordInput id="confirmPassword" name="confirmPassword" placeholder={dictionary.common.passwordPlaceholder} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setConfirmPasswordError(null); }} required minLength={8} autoComplete="new-password" aria-describedby={confirmPasswordError ? "reset-confirm-password-error" : undefined} aria-invalid={Boolean(confirmPasswordError)} showPasswordLabel={dictionary.common.showPassword} hidePasswordLabel={dictionary.common.hidePassword} />
                  <FieldError id="reset-confirm-password-error">{confirmPasswordError}</FieldError>
                </FieldContent>
              </Field>
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? d.submitting : d.submit}
              </Button>
            </form>
            <Button variant="link" size="link" asChild>
              <Link href="/login" className="mx-auto text-meta auth-paragraph-mini text-foreground-muted-accessible hover:text-foreground">{dictionary.common.backToLogin}</Link>
            </Button>
          </>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
