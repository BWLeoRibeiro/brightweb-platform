import type { DashboardSection } from "./types";

export type DashboardSectionErrors = Partial<Record<DashboardSection, string>>;

export function setDashboardSectionError(
  current: DashboardSectionErrors,
  section: DashboardSection,
  message: string,
): DashboardSectionErrors {
  return { ...current, [section]: message };
}

export function clearDashboardSectionErrors(
  current: DashboardSectionErrors,
  sections: DashboardSection[],
): DashboardSectionErrors {
  const next = { ...current };
  for (const section of sections) delete next[section];
  return next;
}
