export const PROJECTS_TIME_ZONE = "Europe/Lisbon";

const PROJECTS_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: PROJECTS_TIME_ZONE,
});

function parseProjectDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getProjectDateKey(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return null;
  const parts = PROJECTS_DATE_KEY_FORMATTER.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function addProjectCalendarDays(value: Date | null, amount: number) {
  const dateKey = getProjectDateKey(value);
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function formatProjectDate(value: string | null, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: PROJECTS_TIME_ZONE,
  });
}

export function formatProjectShortDate(value: string | null, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: PROJECTS_TIME_ZONE,
  });
}

export function formatProjectDateTime(value: string | null, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PROJECTS_TIME_ZONE,
  });
}

export function formatProjectMonthYear(value: string | null, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
    timeZone: PROJECTS_TIME_ZONE,
  });
}

export function formatProjectDayMonth(value: string | null | undefined, fallback = "-") {
  const date = parseProjectDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    timeZone: PROJECTS_TIME_ZONE,
  }).format(date);
}

export function formatProjectWeekday(value: string | null | undefined, fallback = "-") {
  const date = parseProjectDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    timeZone: PROJECTS_TIME_ZONE,
  }).format(date).replace(".", "");
}

export function formatProjectDayOfMonth(value: string | null | undefined, fallback = "--") {
  const date = parseProjectDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    timeZone: PROJECTS_TIME_ZONE,
  }).format(date);
}

export function getProjectCalendarDayDifference(value: string | null | undefined, now: Date | null) {
  const todayKey = getProjectDateKey(now);
  const target = parseProjectDate(value);
  const targetKey = target ? getProjectDateKey(target) : null;
  if (!todayKey || !targetKey) return null;
  const todayUtc = Date.parse(`${todayKey}T00:00:00.000Z`);
  const targetUtc = Date.parse(`${targetKey}T00:00:00.000Z`);
  return Math.round((targetUtc - todayUtc) / 86_400_000);
}

export function isProjectDatePast(value: string | null | undefined, now: Date | null) {
  const difference = getProjectCalendarDayDifference(value, now);
  return difference !== null && difference < 0;
}

export function formatElapsedSince(value: string, now: Date | null) {
  const date = parseProjectDate(value);
  if (!date || !now || Number.isNaN(now.getTime())) return "-";

  const diffMs = now.getTime() - date.getTime();
  if (diffMs <= 0) return "0 min";

  const minutes = Math.floor(diffMs / (60 * 1000));
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (days > 0) return `${days} dia${days === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours} h`;
  return `${minutes} min`;
}

export function truncateProjectSummary(summary: string | null, maxChars = 280) {
  if (!summary) return defaultProjectsUiDictionary.detail.noSummary;
  if (summary.length <= maxChars) return summary;
  return `${summary.slice(0, maxChars).trimEnd()}…`;
}
import { defaultProjectsUiDictionary } from "../dictionary";
