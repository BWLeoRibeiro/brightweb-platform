import Link from "next/link";
import { KeyRound, ShieldCheck, UserCircle2 } from "lucide-react";
import { getCurrentAccountProfile, type AccountProfile } from "./account/profile";
import { requireServerPageAccess } from "./server";
import { AccountClient } from "./ui/account/account-client";
import { defaultAccountUiDictionary } from "./ui/account/dictionary";
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

export async function AccountPage() {
  const { profileId, supabase, user, role } = await requireServerPageAccess();
  const accountProfile = await getCurrentAccountProfile(supabase, user.id, user.email ?? null);
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
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl" style={{ background: "var(--account-identity-surface)", boxShadow: "var(--account-identity-shadow)" }}>
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full" style={{ background: "var(--account-identity-glow-strong)" }} />
        <div className="pointer-events-none absolute -bottom-12 -left-8 size-48 rounded-full" style={{ background: "var(--account-identity-glow-soft)" }} />
        <div className="absolute left-0 right-0 top-0 h-[2px]" style={{ background: "var(--account-identity-accent)" }} />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-5 px-6 py-7 sm:px-8">
          <div className="flex items-center gap-5">
            <div
              className="font-display flex size-[3.75rem] shrink-0 select-none items-center justify-center rounded-full text-xl font-bold"
              style={{
                background: isClient ? "var(--role-client)" : "var(--role-team)",
                color: "var(--account-identity-foreground)",
                boxShadow: isClient ? "var(--account-avatar-ring-client)" : "var(--account-avatar-ring-team)",
              }}
            >
              {initials}
            </div>
            <div>
              <p className="mb-1 text-[length:var(--text-ui-label)] font-bold uppercase tracking-widest" style={{ color: "var(--account-identity-muted)" }}>
                {defaultAccountUiDictionary.identity.kicker}
              </p>
              <h1 className="font-display text-2xl font-bold leading-none" style={{ color: "var(--account-identity-foreground)" }}>
                {displayName}
              </h1>
              {roleLabel ? (
                <span
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[length:var(--text-ui-label)] font-semibold"
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

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div>
          {/* TODO(projects-live): client project previews mount here */}
        </div>

        <div className="space-y-4">
          <article className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="mb-4 flex items-center gap-2">
              <UserCircle2 className="size-3.5 text-muted-foreground" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {defaultAccountUiDictionary.profile.title}
              </h2>
            </div>
            {!accountProfile.ok ? (
              <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {defaultAccountUiDictionary.profile.loadError}: {accountProfile.error}
              </p>
            ) : null}
            <AccountClient profile={profileData} />
          </article>

          <article className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="size-3.5 text-muted-foreground" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {defaultAccountUiDictionary.security.title}
              </h2>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--muted)" }}>
                <p className="mb-0.5 text-[length:var(--text-ui-label)] font-semibold uppercase tracking-wide text-muted-foreground">
                  {defaultAccountUiDictionary.security.email}
                </p>
                <p className="truncate text-sm font-semibold">{user.email ?? defaultAccountUiDictionary.profile.emptyValue}</p>
              </div>

              {profileData.updatedAt ? (
                <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--muted)" }}>
                  <p className="mb-0.5 text-[length:var(--text-ui-label)] font-semibold uppercase tracking-wide text-muted-foreground">
                    {defaultAccountUiDictionary.security.updatedAt}
                  </p>
                  <p className="text-sm font-semibold">{formatDate(profileData.updatedAt)}</p>
                </div>
              ) : null}

              <Link href="/forgot-password" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-primary">
                <KeyRound className="size-3.5 shrink-0" />
                {defaultAccountUiDictionary.security.changePassword}
              </Link>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
