import type { DashboardProjectMilestone } from "./types";
import { type DashboardDictionary } from "./dictionary";

export type TabKey = "overview" | "projects" | "clients" | "tasks";

export type VisualTone = "on" | "watch" | "risk" | "accent";

export const TONE_COLOR: Record<VisualTone, string> = {
  on: "var(--project-state-active)",
  watch: "var(--project-risk-at-risk)",
  risk: "var(--project-risk-overdue)",
  accent: "var(--accent)",
};

export function getGreeting(h: number, dictionary: DashboardDictionary) {
  if (h < 13) return dictionary.greeting.morning;
  if (h < 19) return dictionary.greeting.afternoon;
  return dictionary.greeting.evening;
}

export function formatFullDate(d: Date, dictionary: DashboardDictionary) {
  const weekday = new Intl.DateTimeFormat("pt-PT", { weekday: "long" }).format(d);
  const dow = weekday.charAt(0).toLocaleUpperCase("pt-PT") + weekday.slice(1);
  const month = new Intl.DateTimeFormat("pt-PT", { month: "long" }).format(d);
  return `${dow}, ${d.getDate()} ${dictionary.date.joiner} ${month}`;
}

export function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(d);
}

export function formatDayMonth(iso: string | null | undefined) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(d);
}

export function formatWeekday(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", { weekday: "short" }).format(d).replace(".", "");
}

export function initialsOf(name: string | null | undefined, fallback = "?") {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function isDueThisWeek(iso: string | null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t >= now && t <= now + 7 * 24 * 60 * 60 * 1000;
}

export type UpcomingMilestoneDay = {
  dateKey: string;
  weekday: string;
  fullDate: string;
  isToday: boolean;
  count: number;
  milestones: DashboardProjectMilestone[];
};

function calendarDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildUpcomingMilestoneDays(
  milestones: DashboardProjectMilestone[],
  now = new Date(),
): UpcomingMilestoneDay[] {
  const milestonesByDate = new Map<string, DashboardProjectMilestone[]>();
  for (const milestone of milestones) {
    const dateKey = /^\d{4}-\d{2}-\d{2}/.exec(milestone.targetDate)?.[0];
    if (!dateKey) continue;
    const items = milestonesByDate.get(dateKey);
    if (items) items.push(milestone);
    else milestonesByDate.set(dateKey, [milestone]);
  }

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = calendarDateKey(date);
    const milestonesForDay = milestonesByDate.get(dateKey) ?? [];
    const formattedDate = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" }).format(date);
    return {
      dateKey,
      weekday: new Intl.DateTimeFormat("pt-PT", { weekday: "short" }).format(date).replace(".", "").slice(0, 3),
      fullDate: formattedDate.charAt(0).toLocaleUpperCase("pt-PT") + formattedDate.slice(1),
      isToday: index === 0,
      count: milestonesForDay.length,
      milestones: milestonesForDay,
    };
  });
}
