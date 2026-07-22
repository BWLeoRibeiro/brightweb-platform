export const DASHBOARD_EVENTS = {
  refresh: "dashboard:refresh",
  refreshComplete: "dashboard:refresh-complete",
  state: "dashboard:state",
} as const;

export const DASHBOARD_REFRESH_SECTIONS = ["projects", "crm", "tasks"] as const;
export type DashboardRefreshSection = typeof DASHBOARD_REFRESH_SECTIONS[number];
export type DashboardStateEventDetail = { isLoading?: boolean };
export type DashboardRefreshEventDetail = {
  source?: "manual" | "realtime";
  sections?: DashboardRefreshSection[];
  domain?: "projects" | "crm";
  eventType?: string;
};

export function normalizeDashboardRefreshSections(sections?: DashboardRefreshSection[]) {
  if (!sections?.length) return [...DASHBOARD_REFRESH_SECTIONS];
  const valid = new Set(DASHBOARD_REFRESH_SECTIONS);
  const deduped = sections.filter((section, index) => valid.has(section) && sections.indexOf(section) === index);
  return deduped.length ? deduped : [...DASHBOARD_REFRESH_SECTIONS];
}

export function mergeDashboardRefreshEventDetails(current: DashboardRefreshEventDetail | null | undefined, next: DashboardRefreshEventDetail): DashboardRefreshEventDetail {
  const sections = current ? normalizeDashboardRefreshSections(current.sections) : [];
  for (const section of normalizeDashboardRefreshSections(next.sections)) if (!sections.includes(section)) sections.push(section);
  return { source: next.source ?? current?.source, domain: next.domain, eventType: next.eventType, sections };
}

export function dispatchDashboardEvent(name: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(name));
}

export function dispatchDashboardCustomEvent<T>(name: string, detail: T) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
}
