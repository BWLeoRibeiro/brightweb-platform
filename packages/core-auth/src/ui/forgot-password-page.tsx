"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@brightweblabs/ui/button";
import { Field, FieldContent, FieldLabel } from "@brightweblabs/ui/field";
import { Input } from "@brightweblabs/ui/input";
import { AuthCard, AuthDivider, AuthHeading, AuthLayout, AuthNotice } from "./auth-layout";
import { useAuthUi } from "./context";

export function ForgotPasswordPage() {
  const { client, dictionary } = useAuthUi();
  const d = dictionary.forgot;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const redirectTo = typeof window === "undefined" ? undefined : `${window.location.origin}/reset-password`;
      await client.requestReset({ email: email.trim().toLowerCase(), redirectTo });
      setSuccess(true);
    } catch {
      setError(d.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeading title={d.title} description={success ? d.checkEmail : d.description} />
        <AuthDivider />
        {error ? <AuthNotice id="forgot-password-error">{error}</AuthNotice> : null}
        {success ? (
          <AuthNotice tone="success"><strong>{d.sentTitle}</strong> {d.sentDescription(email)}</AuthNotice>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field>
              <FieldLabel htmlFor="email" className="mb-1.5 block paragraph-small font-semibold text-foreground/60">{dictionary.common.email}</FieldLabel>
              <FieldContent>
                <Input id="email" type="email" placeholder={dictionary.common.emailPlaceholder} value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} aria-describedby={error ? "forgot-password-error" : undefined} aria-invalid={!!error} />
              </FieldContent>
            </Field>
            <Button type="submit" className="h-11 w-full rounded-full" disabled={loading}>
              {loading ? d.submitting : d.submit}
            </Button>
          </form>
        )}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <span className="paragraph-mini text-foreground/40">{d.remember}</span>
          <Button variant="link" size="link" asChild><Link href="/login" className="paragraph-mini font-semibold text-primary hover:text-primary/80">{dictionary.common.login}</Link></Button>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
