import Link from "next/link";
import type { ReactNode } from "react";
import { BriefcaseBusiness, KeyRound, ShieldCheck, UserCircle2 } from "lucide-react";
import { Button, Card, CoverHeader, InitialsAvatar, SectionHeading, StatusPill } from "@brightweblabs/ui";
import { getCurrentAccountProfile, type AccountProfile } from "./account/profile";
import { requireServerPageAccess } from "./server";
import { AccountClient } from "./ui/account/account-client";
import { defaultAccountUiDictionary } from "./ui/account/dictionary";
import { AuthNotice } from "./ui/auth-layout";
import "../tokens.css";

function getRoleLabel(role: string | null | undefined): string | null {
  if (!role) return null;
  return defaultAccountUiDictionary.identity.roleLabels[role.toLowerCase()] ?? role;
}

function formatDate(dateLike: string | null): string {
  if (!dateLike) return defaultAccountUiDictionary.security.noDate;
  const date = dateLike.includes("T") ? new Date(dateLike) : new Date(`${dateLike}T00:00:00`);
  if (Number.isNaN(date.getTime())) return defaultAccountUiDictionary.security.noDate;
  return new Intl.DateTimeFormat(defaultAccountUiDictionary.locale, { dateStyle: "medium" }).format(date);
}

function getInitials(firstName: string, lastName: string, email: string | null): string {
  const first = firstName.trim()[0] ?? "";
  const last = lastName.trim()[0] ?? "";
  if (first || last) return `${first}${last}`.toUpperCase();
  return (email?.[0] ?? "U").toUpperCase();
}

function getDisplayName(firstName: string, lastName: string, email: string | null): string {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  return full || email || defaultAccountUiDictionary.identity.fallbackName;
}

export async function AccountPage({
  internalProjectsHref = "/projetos",
  showWorkAccess = true,
  supplementaryContent,
}: {
  internalProjectsHref?: string;
  showWorkAccess?: boolean;
  supplementaryContent?: ReactNode;
} = {}) {
  const { profileId, supabase, user, role } = await requireServerPageAccess();
  const accountProfile = await getCurrentAccountProfile(supabase, user.id, user.email ?? null);
  if (!accountProfile.ok) {
    console.error("[core-auth.AccountPage.profile]", {
      userId: user.id,
      error: accountProfile.error,
    });
  }
  const profileData: AccountProfile = accountProfile.ok
    ? accountProfile.data
    : {
        profileId,
        email: user.email ?? null,
        firstName: "",
        lastName: "",
        preferredLanguage: "pt-PT",
        updatedAt: null,
      };
  const displayName = getDisplayName(profileData.firstName, profileData.lastName, user.email ?? null);
  const initials = getInitials(profileData.firstName, profileData.lastName, user.email ?? null);
  const isClient = role === "client";
  const roleLabel = getRoleLabel(role);

  return (
    <div className={isClient ? "mx-auto max-w-[68rem] space-y-6" : "space-y-5"}>
      {isClient ? (
        <CoverHeader coverClassName="h-28 sm:h-36">
            <InitialsAvatar
              label={displayName}
              fallback={user.email ?? null}
              tone="client"
              className="-mt-10 size-20 border-4 border-card shadow-[var(--cover-header-avatar-shadow)] [&_[data-slot=avatar-fallback]]:text-heading-3"
            />
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-label font-semibold text-muted-foreground">{defaultAccountUiDictionary.identity.kicker}</p>
                <h1 className="font-display mt-1 text-heading-2 font-bold leading-tight text-foreground">{displayName}</h1>
                <p className="mt-1 truncate text-body text-muted-foreground">{user.email ?? defaultAccountUiDictionary.profile.emptyValue}</p>
              </div>
              {roleLabel ? (
                <StatusPill token="--role-client" size="normal" className="mt-1">
                  <ShieldCheck aria-hidden className="size-3.5" />
                  {roleLabel}
                </StatusPill>
              ) : null}
            </div>
        </CoverHeader>
      ) : (
        <div className="relative overflow-hidden rounded-2xl" style={{ background: "var(--account-identity-surface)", boxShadow: "var(--account-identity-shadow)" }}>
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full" style={{ background: "var(--account-identity-glow-strong)" }} />
          <div className="pointer-events-none absolute -bottom-12 -left-8 size-48 rounded-full" style={{ background: "var(--account-identity-glow-soft)" }} />
          <div className="absolute left-0 right-0 top-0 h-[2px]" style={{ background: "var(--account-identity-accent)" }} />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-5 px-6 py-7 sm:px-8">
            <div className="flex items-center gap-5">
              <div
                className="font-display flex size-[3.75rem] shrink-0 select-none items-center justify-center rounded-full text-heading-3 font-bold"
                style={{
                  background: "var(--role-team)",
                  color: "var(--account-identity-foreground)",
                  boxShadow: "var(--account-avatar-ring-team)",
                }}
              >
                {initials}
              </div>
              <div>
                <p className="mb-1 text-label font-bold" style={{ color: "var(--account-identity-muted)" }}>
                  {defaultAccountUiDictionary.identity.kicker}
                </p>
                <h1 className="font-display text-heading-2 font-bold leading-none" style={{ color: "var(--account-identity-foreground)" }}>
                  {displayName}
                </h1>
                {roleLabel ? (
                  <span
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-label font-semibold"
                    style={{ background: "var(--account-role-surface)", color: "var(--account-identity-accent)", borderColor: "var(--account-role-border)" }}
                  >
                    <ShieldCheck className="size-3" />
                    {roleLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`grid gap-5 ${showWorkAccess ? "lg:grid-cols-2" : "lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]"}`}>
        <div className="space-y-4">
          <Card asChild variant="light">
            <article className="p-5 shadow-none">
              <SectionHeading className="mb-4" icon={UserCircle2} title={defaultAccountUiDictionary.profile.title} />
              {!accountProfile.ok ? (
                <div className="mb-4">
                  <AuthNotice>{defaultAccountUiDictionary.profile.loadError}</AuthNotice>
                </div>
              ) : null}
              <AccountClient profile={profileData} />
            </article>
          </Card>
        </div>

        <div className="space-y-4">
          {supplementaryContent}
          {showWorkAccess ? (
            <Card asChild variant="light">
              <article className="p-5 shadow-none">
                <SectionHeading
                  className="mb-3"
                  icon={BriefcaseBusiness}
                  title={isClient
                    ? defaultAccountUiDictionary.workAccess.clientTitle
                    : defaultAccountUiDictionary.workAccess.internalTitle}
                />
                <p className="text-body text-muted-foreground">
                  {isClient
                    ? defaultAccountUiDictionary.workAccess.clientDescription
                    : defaultAccountUiDictionary.workAccess.internalDescription}
                </p>
                <Button asChild variant="outline" className="mt-4 min-h-11">
                  <Link href={isClient ? "/account/projetos" : internalProjectsHref}>
                    <BriefcaseBusiness className="size-3.5" />
                    {isClient
                      ? defaultAccountUiDictionary.workAccess.clientAction
                      : defaultAccountUiDictionary.workAccess.internalAction}
                  </Link>
                </Button>
              </article>
            </Card>
          ) : null}

          <Card asChild variant="light">
            <article className="p-5 shadow-none">
              <SectionHeading className="mb-4" icon={KeyRound} title={defaultAccountUiDictionary.security.title} />

              <div className="space-y-3">
                <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--muted)" }}>
                  <p className="mb-0.5 text-label font-semibold text-muted-foreground">
                    {defaultAccountUiDictionary.security.email}
                  </p>
                  <p className="truncate text-body font-semibold">{user.email ?? defaultAccountUiDictionary.profile.emptyValue}</p>
                </div>

                {profileData.updatedAt ? (
                  <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--muted)" }}>
                    <p className="mb-0.5 text-label font-semibold text-muted-foreground">
                      {defaultAccountUiDictionary.security.updatedAt}
                    </p>
                    <p className="text-body font-semibold">{formatDate(profileData.updatedAt)}</p>
                  </div>
                ) : null}

                <Button asChild variant="ghost" className="min-h-11 w-full justify-start text-muted-foreground hover:text-primary">
                  <Link href="/forgot-password">
                    <KeyRound className="size-3.5 shrink-0" />
                    {defaultAccountUiDictionary.security.changePassword}
                  </Link>
                </Button>
              </div>
            </article>
          </Card>
        </div>
      </div>
    </div>
  );
}
