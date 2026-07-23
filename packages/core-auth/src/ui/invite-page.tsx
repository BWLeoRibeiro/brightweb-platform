"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@brightweblabs/ui/button";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@brightweblabs/ui/field";
import { Input } from "@brightweblabs/ui/input";
import { PasswordInput } from "@brightweblabs/ui/password-input";
import { PasswordStrength } from "@brightweblabs/ui/password-strength";
import { validatePassword } from "../shared";
import { AuthCard, AuthHeading, AuthLayout, AuthNotice } from "./auth-layout";
import { useAuthUi } from "./context";
import type { AuthInvitation, AuthUiUser } from "./types";

type UnavailableKind = "load-error" | "not-found" | "used" | "expired";

function unavailableKind(invitation: AuthInvitation | null, failed: boolean): UnavailableKind | null {
  if (failed) return "load-error";
  if (!invitation) return "not-found";
  if (invitation.status !== "pending") return "used";
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) return "expired";
  return null;
}

export function InvitePage({ invitationId, kind = "organization" }: { invitationId: string; kind?: AuthInvitation["kind"] }) {
  const router = useRouter();
  const { client, dictionary } = useAuthUi();
  const d = dictionary.invite;
  const passwordRef = useRef<HTMLInputElement>(null);
  const [invitation, setInvitation] = useState<AuthInvitation | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<"identity" | "password">("identity");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([client.getInvitation(invitationId, kind), client.getSession()])
      .then(([value, session]) => {
        if (!cancelled) {
          setInvitation(value);
          setCurrentUser(session.user);
        }
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [client, invitationId, kind]);

  useEffect(() => {
    if (step !== "password") return;
    const timeout = window.setTimeout(() => passwordRef.current?.focus(), 350);
    return () => window.clearTimeout(timeout);
  }, [step]);

  const unavailable = unavailableKind(invitation, failed);
  const email = invitation?.email ?? "";
  const loginHref = email ? `/login?email=${encodeURIComponent(email)}&invite=${encodeURIComponent(invitationId)}` : "/login";
  const role = invitation?.role === "admin"
    ? d.roleLabels.admin
    : invitation?.role === "staff"
      ? d.roleLabels.staff
      : d.roleLabels.client;
  const description = kind === "admin"
    ? d.adminDescription(role, email)
    : d.organizationDescription(invitation?.organizationName ?? "a sua organização", email);
  const sameEmail = Boolean(currentUser?.email && currentUser.email.toLowerCase() === email.toLowerCase());

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!invitation || unavailable) return;
    if (step === "identity") {
      if (!firstName.trim() || !lastName.trim()) {
        setError(d.nameRequired);
        return;
      }
      setError(null);
      setStep("password");
      return;
    }
    setSubmitting(true);
    setError(null);
    if (password !== confirmPassword) {
      setError(d.mismatch);
      setSubmitting(false);
      return;
    }
    const validation = validatePassword(password);
    if (!validation.isValid) {
      setError(validation.errors.join(". "));
      setSubmitting(false);
      return;
    }
    try {
      const result = await client.registerInvite({ invitationId, firstName, lastName, password, kind });
      router.replace(`/login?message=invite-accepted&email=${encodeURIComponent(result.email || email)}`);
    } catch (caught) {
      setError((caught as Error)?.message || d.unavailable["load-error"].description);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard>
        {loading ? <p className="paragraph-mini text-center text-muted-foreground">{dictionary.common.loading}</p> : (
          <>
            <AuthHeading
              eyebrow={currentUser ? d.activeSession : d.eyebrow}
              title={currentUser ? (sameEmail ? d.sameAccount : d.otherAccount) : unavailable ? d.unavailable[unavailable].title : d.title}
              description={currentUser ? (sameEmail ? d.sameAccountDescription : d.otherAccountDescription) : unavailable ? d.unavailable[unavailable].description : description}
            />
            {currentUser ? (
              <Button asChild className="h-11 w-full rounded-full">
                <Link href={sameEmail ? `/auth/post-login?invitationId=${encodeURIComponent(invitationId)}` : "/login"}>
                  {sameEmail ? dictionary.common.continue : dictionary.common.login}
                </Link>
              </Button>
            ) : unavailable ? (
              <div className="flex flex-col gap-3">
                {unavailable === "load-error" ? <Button type="button" onClick={() => window.location.reload()} className="h-11 w-full rounded-full">{dictionary.common.retry}</Button> : null}
                <Button asChild variant={unavailable === "load-error" ? "ghost" : "default"} className="h-11 w-full rounded-full"><Link href={loginHref}>{dictionary.common.login}</Link></Button>
                {unavailable === "used" || unavailable === "expired" ? <p className="paragraph-mini text-center text-foreground/45">{d.contactForInvite}</p> : null}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {error ? <AuthNotice id="invite-error">{error}</AuthNotice> : null}
                {step === "identity" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field><FieldLabel htmlFor="firstName" className="mb-1.5 paragraph-small font-semibold text-foreground/60">{dictionary.common.firstName}</FieldLabel><FieldContent><Input id="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} required autoComplete="given-name" /></FieldContent></Field>
                      <Field><FieldLabel htmlFor="lastName" className="mb-1.5 paragraph-small font-semibold text-foreground/60">{dictionary.common.lastName}</FieldLabel><FieldContent><Input id="lastName" value={lastName} onChange={(event) => setLastName(event.target.value)} required autoComplete="family-name" /></FieldContent></Field>
                    </div>
                    <Field><FieldLabel htmlFor="email" className="mb-1.5 paragraph-small font-semibold text-foreground/60">{dictionary.common.email}</FieldLabel><FieldContent><Input id="email" type="email" value={email} disabled autoComplete="email" /></FieldContent></Field>
                  </>
                ) : (
                  <>
                    <Field>
                      <FieldLabel htmlFor="password" className="mb-1.5 paragraph-small font-semibold text-foreground/60">{dictionary.common.password}</FieldLabel>
                      <FieldContent><PasswordInput ref={passwordRef} id="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" aria-describedby={error ? "invite-error" : "invite-password-description"} aria-invalid={!!error} showPasswordLabel={dictionary.common.showPassword} hidePasswordLabel={dictionary.common.hidePassword} />{password ? <PasswordStrength password={password} className="mt-2" /> : null}<FieldDescription id="invite-password-description" className="mt-1.5 paragraph-mini text-foreground/35">{dictionary.reset.passwordHint}</FieldDescription></FieldContent>
                    </Field>
                    <Field><FieldLabel htmlFor="confirmPassword" className="mb-1.5 paragraph-small font-semibold text-foreground/60">{dictionary.common.confirmPassword}</FieldLabel><FieldContent><PasswordInput id="confirmPassword" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" showPasswordLabel={dictionary.common.showPassword} hidePasswordLabel={dictionary.common.hidePassword} /></FieldContent></Field>
                  </>
                )}
                <Button type="submit" className="h-11 w-full rounded-full" disabled={submitting}>{step === "identity" ? dictionary.common.continue : submitting ? d.creating : d.create}</Button>
                {step === "password" ? <Button type="button" variant="ghost" className="h-10 w-full rounded-full" disabled={submitting} onClick={() => { setError(null); setStep("identity"); }}>{dictionary.common.back}</Button> : null}
              </form>
            )}
            <div className="flex items-center justify-center gap-1.5 pt-1"><span className="paragraph-mini text-foreground/40">{d.alreadyAccount}</span><Button variant="link" size="link" asChild><Link href={loginHref} className="paragraph-mini font-semibold text-primary hover:text-primary/80">{dictionary.common.login}</Link></Button></div>
          </>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
