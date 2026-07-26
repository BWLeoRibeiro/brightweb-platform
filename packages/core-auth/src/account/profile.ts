import type { User } from "@supabase/supabase-js";
import type { createServerSupabase } from "@brightweblabs/infra/server";

export const ACCOUNT_LANGUAGES = ["pt-PT", "en"] as const;
export const ACCOUNT_NAME_MAX_LENGTH = 80;

export type AccountLanguage = (typeof ACCOUNT_LANGUAGES)[number];

export type AccountProfile = {
  profileId: string | null;
  email: string | null;
  firstName: string;
  lastName: string;
  preferredLanguage: AccountLanguage;
  updatedAt: string | null;
};

export type AccountProfileResult =
  | { ok: true; data: AccountProfile }
  | { ok: false; error: string };

export type AccountProfileInput = {
  firstName: string;
  lastName: string;
  preferredLanguage: AccountLanguage;
};

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

type AccountProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  updated_at: string | null;
  preferences?: unknown;
  user_preferences?: unknown;
};

type UserPreferenceRow = {
  preferred_language: string | null;
};

function normalizeLanguage(value: unknown): AccountLanguage {
  return value === "en" ? "en" : "pt-PT";
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isAccountLanguage(value: unknown): value is AccountLanguage {
  return ACCOUNT_LANGUAGES.includes(value as AccountLanguage);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function relationOne(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : null;
  return isRecord(value) ? value : null;
}

function embeddedPreference(profile: AccountProfileRow | null): Record<string, unknown> | null {
  if (!profile) return null;
  return relationOne(profile.preferences ?? profile.user_preferences);
}

function getPostgrestErrorText(error: unknown): { code: string; text: string } {
  if (!isRecord(error)) {
    return {
      code: "",
      text: error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase(),
    };
  }

  const parts = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());

  return {
    code: typeof error.code === "string" ? error.code : "",
    text: parts.join(" "),
  };
}

function isEmbeddedPreferencesRelationshipError(error: unknown): boolean {
  const { code, text } = getPostgrestErrorText(error);
  if (code !== "PGRST200" && code !== "PGRST201") return false;
  return text.includes("user_preferences")
    && (
      text.includes("relationship")
      || text.includes("schema cache")
      || text.includes("embed")
      || text.includes("embedding")
    );
}

function toAccountProfile(
  profile: AccountProfileRow | null,
  fallbackEmail: string | null,
  preferredLanguage: AccountLanguage,
): AccountProfile {
  return {
    profileId: profile?.id ?? null,
    email: profile?.email ?? fallbackEmail ?? null,
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    preferredLanguage,
    updatedAt: profile?.updated_at ?? null,
  };
}

async function getCurrentAccountProfileFallback(
  supabase: ServerSupabase,
  userId: string,
  fallbackEmail: string | null,
): Promise<AccountProfileResult> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, updated_at")
    .eq("user_id", userId)
    .maybeSingle<AccountProfileRow>();

  if (profileError) return { ok: false, error: profileError.message };

  let preferredLanguage: AccountLanguage = "pt-PT";
  if (profile?.id) {
    const { data: preference, error: preferenceError } = await supabase
      .from("user_preferences")
      .select("preferred_language")
      .eq("profile_id", profile.id)
      .maybeSingle<UserPreferenceRow>();

    if (preferenceError) return { ok: false, error: preferenceError.message };
    preferredLanguage = normalizeLanguage(preference?.preferred_language);
  }

  return { ok: true, data: toAccountProfile(profile, fallbackEmail, preferredLanguage) };
}

export async function getCurrentAccountProfile(
  supabase: ServerSupabase,
  userId: string,
  fallbackEmail: string | null,
): Promise<AccountProfileResult> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, updated_at, preferences:user_preferences(preferred_language)")
    .eq("user_id", userId)
    .maybeSingle<AccountProfileRow>();

  if (profileError) {
    if (isEmbeddedPreferencesRelationshipError(profileError)) {
      return getCurrentAccountProfileFallback(supabase, userId, fallbackEmail);
    }
    return { ok: false, error: profileError.message };
  }

  const preference = embeddedPreference(profile);
  return {
    ok: true,
    data: toAccountProfile(profile, fallbackEmail, normalizeLanguage(preference?.preferred_language)),
  };
}

export async function updateCurrentAccountProfile(
  supabase: ServerSupabase,
  user: User,
  input: AccountProfileInput,
): Promise<AccountProfileResult> {
  if (typeof input.firstName !== "string" || typeof input.lastName !== "string") {
    return { ok: false, error: "Nome inválido." };
  }

  const firstName = normalizeName(input.firstName);
  const lastName = normalizeName(input.lastName);
  if (firstName.length > ACCOUNT_NAME_MAX_LENGTH || lastName.length > ACCOUNT_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Nome inválido. Limite máximo de ${ACCOUNT_NAME_MAX_LENGTH} caracteres por campo.`,
    };
  }
  if (!isAccountLanguage(input.preferredLanguage)) {
    return { ok: false, error: "Idioma inválido." };
  }
  const preferredLanguage = input.preferredLanguage;

  const accountProfile = await getCurrentAccountProfile(supabase, user.id, user.email ?? null);
  if (!accountProfile.ok) return accountProfile;

  const email = user.email ?? accountProfile.data.email ?? null;
  if (!email) return { ok: false, error: "Não foi possível determinar o email da conta." };

  const { data: upsertedProfile, error: upsertProfileError } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        email,
        first_name: firstName || null,
        last_name: lastName || null,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single<{ id: string }>();

  if (upsertProfileError) return { ok: false, error: upsertProfileError.message };

  const profileId = upsertedProfile?.id;
  if (!profileId) return { ok: false, error: "Não foi possível resolver o perfil da conta." };

  // These caller-scoped upserts are not atomic: the profile must exist before its
  // preference FK can be written. Both failures are checked and retries are safe
  // because both writes are upserts; a preference failure is returned explicitly.
  const { error: preferencesError } = await supabase
    .from("user_preferences")
    .upsert(
      {
        profile_id: profileId,
        preferred_language: preferredLanguage,
      },
      { onConflict: "profile_id" },
    );

  if (preferencesError) return { ok: false, error: preferencesError.message };

  const { error: authMetadataError } = await supabase.auth.updateUser({
    data: {
      first_name: firstName || null,
      last_name: lastName || null,
    },
  });
  if (authMetadataError) {
    // The database-backed account fields are authoritative and already persisted.
    // Metadata is best-effort compatibility data, so report the provider failure
    // server-side without turning a completed database write into a false failure.
    console.error("[core-auth.updateCurrentAccountProfile.authMetadata]", {
      userId: user.id,
      message: authMetadataError.message,
    });
  }

  return getCurrentAccountProfile(supabase, user.id, email);
}
