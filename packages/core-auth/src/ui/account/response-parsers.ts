import type { AccountLanguage, AccountProfile } from "../../account/profile";

type RecordValue = Record<string, unknown>;

function record(value: unknown, label: string): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${label} response.`);
  }
  return value as RecordValue;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`Invalid ${label} response.`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value !== null && typeof value !== "string") throw new Error(`Invalid ${label} response.`);
  return value as string | null;
}

function language(value: unknown): AccountLanguage {
  if (value !== "pt-PT" && value !== "en") throw new Error("Invalid account profile response.");
  return value;
}

export function parseAccountProfileResponse(value: unknown): AccountProfile {
  const profile = record(record(value, "account profile").data, "account profile data");
  return {
    profileId: nullableString(profile.profileId, "account profile"),
    email: nullableString(profile.email, "account profile"),
    firstName: string(profile.firstName, "account profile"),
    lastName: string(profile.lastName, "account profile"),
    preferredLanguage: language(profile.preferredLanguage),
    updatedAt: nullableString(profile.updatedAt, "account profile"),
  };
}
