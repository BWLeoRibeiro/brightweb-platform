import type { ProjectListItem } from "../../types";

export type ProjectRisk = "overdue" | "at_risk";

// Shared risk vocabulary so the portfolio card and the detail hero read the
// same: a late project says "Atrasado" in the list and on its own page.
export const PROJECT_RISK_META: Record<ProjectRisk, { label: string; var: string }> = {
  overdue: { label: "Atrasado", var: "var(--project-risk-overdue)" },
  at_risk: { label: "Em risco", var: "var(--project-risk-at-risk)" },
};

export function isPastDate(value: string | null) {
  if (!value) return false;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed.getTime() < today.getTime();
}

type ProjectRiskInput = Pick<ProjectListItem, "status" | "health" | "targetDate">;

export function resolveProjectRisk(project: ProjectRiskInput): ProjectRisk | null {
  if (project.status === "completed" || project.status === "canceled") return null;
  if (isPastDate(project.targetDate)) return "overdue";
  if (project.health === "at_risk" || project.health === "off_track") return "at_risk";
  return null;
}
