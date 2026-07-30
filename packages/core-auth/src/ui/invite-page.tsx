"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@brightweblabs/ui/button";
import { Field, FieldContent, FieldError, FieldLabel } from "@brightweblabs/ui/field";
import { Input } from "@brightweblabs/ui/input";
import { PasswordInput } from "@brightweblabs/ui/password-input";
import { PasswordStrength } from "@brightweblabs/ui/password-strength";
import { validatePassword } from "../shared";
import {
  AuthCard,
  AuthHeading,
  AuthLayout,
  AuthLoadingState,
  AuthNotice,
  AuthStateMark,
  AuthStepIndicator,
} from "./auth-layout";
import { useAuthUi } from "./context";
import { resolveInvitationUnavailableKind, type InvitationUnavailableKind } from "./invite-state";
import type { AuthInvitation, AuthUiUser } from "./types";

type InviteStep = "identity" | "password";
type InviteField = "firstName" | "lastName" | "password" | "confirmPassword";
type InviteFieldErrors = Partial<Record<InviteField, string>>;

export interface InvitePageProps {
  invitationId: string;
  kind?: AuthInvitation["kind"];
}

function stateTone(kind: InvitationUnavailableKind) {
  if (kind === "load-error") return "error" as const;
  if (kind === "expired" || kind === "revoked") return "warning" as const;
  return "neutral" as const;
}

export function InvitePage({ invitationId, kind = "organization" }: InvitePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { client, dictionary } = useAuthUi();
  const d = dictionary.invite;
  const passwordRef = useRef<HTMLInputElement>(null);
  const [invitation, setInvitation] = useState<AuthInvitation | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<InviteStep>("identity");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<InviteFieldErrors>({});
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    Promise.allSettled([client.getInvitation(invitationId, kind), client.getSession()])
      .then(([invitationResult, sessionResult]) => {
        if (cancelled) return;
        if (invitationResult.status === "fulfilled") setInvitation(invitationResult.value);
        else setFailed(true);
        setCurrentUser(sessionResult.status === "fulfilled" ? sessionResult.value.user : null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [client, invitationId, kind]);

  useEffect(() => {
    if (step !== "password") return;
    const timeout = window.setTimeout(() => passwordRef.current?.focus(), 150);
    return () => window.clearTimeout(timeout);
  }, [step]);

  const unavailable = resolveInvitationUnavailableKind(invitation, failed);
  const email = invitation?.email ?? "";
  const loginHref = email
    ? `/login?email=${encodeURIComponent(email)}&invite=${encodeURIComponent(invitationId)}&inviteKind=${kind}`
    : "/login";
  const role = invitation?.role === "admin"
    ? d.roleLabels.admin
    : invitation?.role === "staff"
      ? d.roleLabels.staff
      : d.roleLabels.client;
  const description = kind === "admin"
    ? d.adminDescription(role, email)
    : d.organizationDescription(invitation?.organizationName ?? "a sua organização", email);
  const sameEmail = Boolean(currentUser?.email && currentUser.email.toLowerCase() === email.toLowerCase());
  const acceptanceFailed = searchParams.get("acceptError") === "1";
  const acceptanceErrorCopy = d.acceptanceError ?? {
    title: d.sameAccount,
    description: d.unavailable["load-error"].description,
    retry: dictionary.common.retry,
  };

  function clearFieldError(field: InviteField) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSwitchAccount() {
    setSwitchingAccount(true);
    setError(null);
    try {
      await client.signOutLocal();
      setCurrentUser(null);
    } catch {
      setError(dictionary.login.authSystemError);
    } finally {
      setSwitchingAccount(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!invitation || unavailable) return;
    if (step === "identity") {
      const nextErrors: InviteFieldErrors = {};
      if (!firstName.trim()) nextErrors.firstName = d.nameRequired;
      if (!lastName.trim()) nextErrors.lastName = d.nameRequired;
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }
      setError(null);
      setFieldErrors({});
      setStep("password");
      return;
    }

    const nextErrors: InviteFieldErrors = {};
    const validation = validatePassword(password);
    if (!validation.isValid) nextErrors.password = validation.errors.join(". ");
    if (password !== confirmPassword) nextErrors.confirmPassword = d.mismatch;
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await client.registerInvite({ invitationId, firstName, lastName, password, kind });
      setSuccessEmail(result.email || email);
    } catch (caught) {
      setError((caught as Error)?.message || d.unavailable["load-error"].description);
    } finally {
      setSubmitting(false);
    }
  }

  const successCopy = d.success ?? {
    eyebrow: d.eyebrow,
    title: d.create,
    description: (value: string) => value,
    action: dictionary.common.login,
  };

  return (
    <AuthLayout>
      <AuthCard>
        {loading ? <AuthLoadingState label={dictionary.common.loading} /> : successEmail ? (
          <div className="auth-state-panel">
            <AuthStateMark tone="success" />
            <AuthHeading
              eyebrow={successCopy.eyebrow}
              title={successCopy.title}
              description={successCopy.description(successEmail)}
            />
            <Button asChild className="h-11 w-full">
              <Link href={`/login?email=${encodeURIComponent(successEmail)}`}>{successCopy.action}</Link>
            </Button>
          </div>
        ) : unavailable ? (
          <div className="auth-state-panel">
            <AuthStateMark tone={stateTone(unavailable)} />
            <AuthHeading
              eyebrow={d.eyebrow}
              title={(d.unavailable[unavailable] ?? d.unavailable.used).title}
              description={(d.unavailable[unavailable] ?? d.unavailable.used).description}
            />
            <div className="flex flex-col gap-3">
              {unavailable === "load-error" ? (
                <Button type="button" onClick={() => window.location.reload()} className="h-11 w-full">
                  {dictionary.common.retry}
                </Button>
              ) : null}
              {unavailable === "accepted" || unavailable === "not-found" ? (
                <Button asChild className="h-11 w-full"><Link href={loginHref}>{dictionary.common.login}</Link></Button>
              ) : (
                <Button asChild variant="ghost" className="h-11 w-full"><Link href="/login">{dictionary.common.login}</Link></Button>
              )}
              {unavailable === "expired" || unavailable === "revoked" ? (
                <p className="text-meta auth-paragraph-mini text-center text-foreground-muted-accessible">{d.contactForInvite}</p>
              ) : null}
            </div>
          </div>
        ) : currentUser ? (
          <div className="auth-state-panel">
            <AuthStateMark tone={acceptanceFailed && sameEmail ? "error" : sameEmail ? "success" : "warning"} />
            <AuthHeading
              eyebrow={d.activeSession}
              title={acceptanceFailed && sameEmail ? acceptanceErrorCopy.title : sameEmail ? d.sameAccount : d.otherAccount}
              description={acceptanceFailed && sameEmail ? acceptanceErrorCopy.description : sameEmail ? d.sameAccountDescription : d.otherAccountDescription}
            />
            {error ? <AuthNotice id="invite-session-error">{error}</AuthNotice> : null}
            {sameEmail ? (
              <Button asChild className="h-11 w-full">
                <Link href={`/auth/post-login?invitationId=${encodeURIComponent(invitationId)}&invitationKind=${kind}`}>
                  {acceptanceFailed ? acceptanceErrorCopy.retry : dictionary.common.continue}
                </Link>
              </Button>
            ) : (
              <Button type="button" className="h-11 w-full" disabled={switchingAccount} onClick={() => void handleSwitchAccount()}>
                {switchingAccount ? dictionary.common.loading : dictionary.common.switchAccount ?? dictionary.common.login}
              </Button>
            )}
          </div>
        ) : (
          <>
            <AuthHeading eyebrow={d.eyebrow} title={d.title} description={description} />
            <AuthStepIndicator
              current={step === "identity" ? 1 : 2}
              total={2}
              label={step === "identity" ? d.identityStep ?? d.title : d.passwordStep ?? dictionary.common.password}
            />
            <div className="auth-invitation-context">
              <span>{d.invitedEmailLabel ?? dictionary.common.email}</span>
              <strong>{email}</strong>
              <span>{role}</span>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5" aria-busy={submitting}>
              <input type="email" name="email" value={email} readOnly className="sr-only" tabIndex={-1} aria-hidden="true" />
              {error ? <AuthNotice id="invite-error">{error}</AuthNotice> : null}
              {step === "identity" ? (
                <div className="auth-name-grid">
                  <Field data-invalid={Boolean(fieldErrors.firstName)}>
                    <FieldLabel htmlFor="firstName" className="mb-1.5 text-body auth-paragraph-small font-semibold text-foreground-muted-accessible">{dictionary.common.firstName}</FieldLabel>
                    <FieldContent>
                      <Input id="firstName" name="firstName" value={firstName} onChange={(event) => { setFirstName(event.target.value); clearFieldError("firstName"); }} required autoComplete="given-name" aria-invalid={Boolean(fieldErrors.firstName)} aria-describedby={fieldErrors.firstName ? "invite-first-name-error" : undefined} />
                      <FieldError id="invite-first-name-error">{fieldErrors.firstName}</FieldError>
                    </FieldContent>
                  </Field>
                  <Field data-invalid={Boolean(fieldErrors.lastName)}>
                    <FieldLabel htmlFor="lastName" className="mb-1.5 text-body auth-paragraph-small font-semibold text-foreground-muted-accessible">{dictionary.common.lastName}</FieldLabel>
                    <FieldContent>
                      <Input id="lastName" name="lastName" value={lastName} onChange={(event) => { setLastName(event.target.value); clearFieldError("lastName"); }} required autoComplete="family-name" aria-invalid={Boolean(fieldErrors.lastName)} aria-describedby={fieldErrors.lastName ? "invite-last-name-error" : undefined} />
                      <FieldError id="invite-last-name-error">{fieldErrors.lastName}</FieldError>
                    </FieldContent>
                  </Field>
                </div>
              ) : (
                <>
                  <Field data-invalid={Boolean(fieldErrors.password)}>
                    <FieldLabel htmlFor="password" className="mb-1.5 text-body auth-paragraph-small font-semibold text-foreground-muted-accessible">{dictionary.common.password}</FieldLabel>
                    <FieldContent>
                      <PasswordInput ref={passwordRef} id="password" name="password" value={password} onChange={(event) => { setPassword(event.target.value); clearFieldError("password"); }} required minLength={8} autoComplete="new-password" aria-describedby={fieldErrors.password ? "invite-password-error" : "invite-password-description"} aria-invalid={Boolean(fieldErrors.password)} showPasswordLabel={dictionary.common.showPassword} hidePasswordLabel={dictionary.common.hidePassword} />
                      {password ? <PasswordStrength password={password} labels={dictionary.common.passwordStrength} className="mt-2" /> : null}
                      <p id="invite-password-description" className="mt-1.5 text-meta auth-paragraph-mini text-foreground-muted-accessible">{dictionary.reset.passwordHint}</p>
                      <FieldError id="invite-password-error">{fieldErrors.password}</FieldError>
                    </FieldContent>
                  </Field>
                  <Field data-invalid={Boolean(fieldErrors.confirmPassword)}>
                    <FieldLabel htmlFor="confirmPassword" className="mb-1.5 text-body auth-paragraph-small font-semibold text-foreground-muted-accessible">{dictionary.common.confirmPassword}</FieldLabel>
                    <FieldContent>
                      <PasswordInput id="confirmPassword" name="confirmPassword" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); clearFieldError("confirmPassword"); }} required minLength={8} autoComplete="new-password" aria-describedby={fieldErrors.confirmPassword ? "invite-confirm-password-error" : undefined} aria-invalid={Boolean(fieldErrors.confirmPassword)} showPasswordLabel={dictionary.common.showPassword} hidePasswordLabel={dictionary.common.hidePassword} />
                      <FieldError id="invite-confirm-password-error">{fieldErrors.confirmPassword}</FieldError>
                    </FieldContent>
                  </Field>
                </>
              )}
              <Button type="submit" className="h-11 w-full" disabled={submitting}>
                {step === "identity" ? dictionary.common.continue : submitting ? d.creating : d.create}
              </Button>
              {step === "password" ? (
                <Button type="button" variant="ghost" className="h-10 w-full" disabled={submitting} onClick={() => { setError(null); setFieldErrors({}); setStep("identity"); }}>
                  {dictionary.common.back}
                </Button>
              ) : null}
            </form>
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <span className="text-meta auth-paragraph-mini text-foreground-muted-accessible">{d.alreadyAccount}</span>
              <Button variant="link" size="link" asChild>
                <Link href={loginHref} className="text-meta auth-paragraph-mini font-semibold text-primary hover:text-primary/80">{dictionary.common.login}</Link>
              </Button>
            </div>
          </>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
