"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@brightweblabs/ui/button";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@brightweblabs/ui/field";
import { PasswordInput } from "@brightweblabs/ui/password-input";
import { PasswordStrength } from "@brightweblabs/ui/password-strength";
import { validatePassword } from "../shared";
import { AuthCard, AuthDivider, AuthHeading, AuthLayout, AuthNotice } from "./auth-layout";
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
  client: Pick<AuthUiClient, "establishRecoverySession" | "exchangeRecoveryCode">,
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

  return { error: null, replacementPath: null };
}

export function ResetPasswordPage() {
  const router = useRouter();
  const { client, dictionary } = useAuthUi();
  const d = dictionary.reset;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function prepareRecovery() {
      const currentUrl = new URL(window.location.href);
      try {
        const result = await prepareRecoveryUrl(currentUrl, client, d.invalidLink);
        if (!mounted) return;
        if (result.error) setError(result.error);
        if (result.replacementPath) router.replace(result.replacementPath);
      } catch {
        if (mounted) setError(d.invalidLink);
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
    if (password !== confirmPassword) {
      setError(d.mismatch);
      setLoading(false);
      return;
    }
    const validation = validatePassword(password);
    if (!validation.isValid) {
      setError(validation.errors.join(". "));
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
        <AuthHeading title={d.title} description={d.description} />
        <AuthDivider />
        {error ? <AuthNotice id="reset-password-error">{error}</AuthNotice> : null}
        <form onSubmit={handleSubmit} className="auth-form">
          <Field>
            <FieldLabel htmlFor="password" className="auth-field-label">{dictionary.common.newPassword}</FieldLabel>
            <FieldContent>
              <PasswordInput id="password" placeholder={dictionary.common.passwordPlaceholder} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" aria-describedby={error ? "reset-password-error" : "password-description"} aria-invalid={!!error} showPasswordLabel={dictionary.common.showPassword} hidePasswordLabel={dictionary.common.hidePassword} />
              {password ? <PasswordStrength password={password} className="auth-password-strength" /> : null}
              <FieldDescription id="password-description" className="auth-field-hint text-foreground-muted-accessible">{d.passwordHint}</FieldDescription>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword" className="auth-field-label">{dictionary.common.confirmPassword}</FieldLabel>
            <FieldContent>
              <PasswordInput id="confirmPassword" placeholder={dictionary.common.passwordPlaceholder} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" aria-describedby={error ? "reset-password-error" : undefined} aria-invalid={!!error} showPasswordLabel={dictionary.common.showPassword} hidePasswordLabel={dictionary.common.hidePassword} />
            </FieldContent>
          </Field>
          <Button type="submit" className="auth-primary-action" disabled={loading || preparing}>
            {preparing ? d.preparing : loading ? d.submitting : d.submit}
          </Button>
        </form>
        <Button variant="link" size="link" asChild><Link href="/login" className="auth-support-action">{dictionary.common.backToLogin}</Link></Button>
      </AuthCard>
    </AuthLayout>
  );
}
