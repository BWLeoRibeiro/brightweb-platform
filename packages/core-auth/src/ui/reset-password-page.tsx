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
      const code = currentUrl.searchParams.get("code");
      const authError = currentUrl.searchParams.get("error") ?? currentUrl.searchParams.get("error_description");
      if (authError) {
        setError(d.invalidLink);
        setPreparing(false);
        return;
      }
      if (!code) {
        setPreparing(false);
        return;
      }
      try {
        await client.exchangeRecoveryCode(code);
        for (const key of ["code", "type", "error", "error_description"]) currentUrl.searchParams.delete(key);
        router.replace(`${currentUrl.pathname}${currentUrl.search}`);
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field>
            <FieldLabel htmlFor="password" className="mb-1.5 block paragraph-small font-semibold text-foreground/60">{dictionary.common.newPassword}</FieldLabel>
            <FieldContent>
              <PasswordInput id="password" placeholder={dictionary.common.passwordPlaceholder} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" aria-describedby={error ? "reset-password-error" : "password-description"} aria-invalid={!!error} showPasswordLabel={dictionary.common.showPassword} hidePasswordLabel={dictionary.common.hidePassword} />
              {password ? <PasswordStrength password={password} className="mt-2" /> : null}
              <FieldDescription id="password-description" className="mt-1.5 paragraph-mini text-foreground/35">{d.passwordHint}</FieldDescription>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword" className="mb-1.5 block paragraph-small font-semibold text-foreground/60">{dictionary.common.confirmPassword}</FieldLabel>
            <FieldContent>
              <PasswordInput id="confirmPassword" placeholder={dictionary.common.passwordPlaceholder} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" aria-describedby={error ? "reset-password-error" : undefined} aria-invalid={!!error} showPasswordLabel={dictionary.common.showPassword} hidePasswordLabel={dictionary.common.hidePassword} />
            </FieldContent>
          </Field>
          <Button type="submit" className="h-11 w-full rounded-full" disabled={loading || preparing}>
            {preparing ? d.preparing : loading ? d.submitting : d.submit}
          </Button>
        </form>
        <Button variant="link" size="link" asChild><Link href="/login" className="mx-auto paragraph-mini text-foreground/60 hover:text-foreground">{dictionary.common.backToLogin}</Link></Button>
      </AuthCard>
    </AuthLayout>
  );
}
