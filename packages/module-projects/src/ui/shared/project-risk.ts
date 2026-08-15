import type { ProjectListItem } from "../../types";
import { defaultProjectsUiDictionary } from "../dictionary";
import { isProjectDatePast } from "./formatters";

export type ProjectRisk = "overdue" | "at_risk";

// Shared risk vocabulary so the portfolio card and the detail hero read the
// same risk wording in the list and on its own page.
export const PROJECT_RISK_META: Record<ProjectRisk, { label: string; var: string }> = {
  overdue: { label: defaultProjectsUiDictionary.status.delayed, var: "var(--project-risk-overdue)" },
  at_risk: { label: defaultProjectsUiDictionary.status.at_risk, var: "var(--project-risk-at-risk)" },
};

type ProjectRiskInput = Pick<ProjectListItem, "status" | "health" | "targetDate">;

export function resolveProjectRisk(project: ProjectRiskInput, now: Date | null): ProjectRisk | null {
  if (project.status === "completed" || project.status === "canceled") return null;
  if (isProjectDatePast(project.targetDate, now)) return "overdue";
  if (project.health === "at_risk" || project.health === "off_track") return "at_risk";
  return null;
}
