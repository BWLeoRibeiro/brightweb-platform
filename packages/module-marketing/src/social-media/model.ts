import type { SocialMediaPublication } from "./types";

export function publicationMonths(events: SocialMediaPublication[]) {
  return [...new Set(events.map((event) => event.date.slice(0, 7)))].sort();
}

export function filterPublications(events: SocialMediaPublication[], month: string, type: string) {
  return events.filter((event) => event.date.startsWith(`${month}-`) && (type === "all" || event.type === type))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function calendarDays(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) return [];
  const dateAt = (monthIndex: number, day: number) => {
    const date = new Date(0);
    date.setUTCFullYear(year, monthIndex, day);
    return date;
  };
  const offset = (dateAt(monthNumber - 1, 1).getUTCDay() + 6) % 7;
  const days = dateAt(monthNumber, 0).getUTCDate();
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
    const date = dateAt(monthNumber - 1, index - offset + 1).toISOString().split("T")[0];
    return { date, day: Number(date.slice(-2)), inMonth: date.startsWith(month) };
  });
}

export function safeSocialMediaHref(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
