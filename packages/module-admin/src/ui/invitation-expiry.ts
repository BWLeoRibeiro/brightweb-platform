import type { AdminUiDictionary } from "./types";

function formatDate(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export function formatInvitationExpiry(
  value: string,
  locale: string,
  dictionary: AdminUiDictionary,
  now = new Date(),
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const remainingMs = date.getTime() - now.getTime();
  if (remainingMs <= 0) return dictionary.invitations.expired ?? formatDate(date, locale);
  if (formatDate(date, locale) === formatDate(now, locale)) {
    return dictionary.invitations.expiresToday ?? formatDate(date, locale);
  }

  const days = Math.ceil(remainingMs / 86_400_000);
  if (days <= 3 && dictionary.invitations.expirySoon) return dictionary.invitations.expirySoon(days);
  return formatDate(date, locale);
}
