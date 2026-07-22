import type { ProjectListItem } from "../types";

type ProjectItem = Pick<
  ProjectListItem,
  "id" | "organizationName" | "name" | "code" | "status" | "health" | "ownerLabel" | "targetDate" | "taskStats"
>;

export type ListProjectsPayload = {
  items: ProjectItem[];
  total: number;
  page: number;
  pageSize: number;
  attentionSummary: {
    total: number;
    overdue: number;
    atRisk: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProjectItem(value: unknown): value is ProjectItem {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.name !== "string") return false;
  if (typeof value.organizationName !== "string") return false;
  if (!isRecord(value.taskStats)) return false;
  const taskStats = value.taskStats;
  return (
    typeof taskStats.total === "number"
    && typeof taskStats.done === "number"
    && typeof taskStats.overdue === "number"
    && typeof taskStats.blocked === "number"
  );
}

function isListProjectsPayload(value: unknown): value is ListProjectsPayload {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.items)) return false;
  if (typeof value.total !== "number") return false;
  if (typeof value.page !== "number") return false;
  if (typeof value.pageSize !== "number") return false;
  if (!isRecord(value.attentionSummary)) return false;
  if (typeof value.attentionSummary.total !== "number") return false;
  if (typeof value.attentionSummary.overdue !== "number") return false;
  if (typeof value.attentionSummary.atRisk !== "number") return false;
  return value.items.every(isProjectItem);
}

export function parseListProjectsPayload(payload: unknown): ListProjectsPayload | null {
  if (!isRecord(payload)) return null;
  return isListProjectsPayload(payload.data) ? payload.data : null;
}

export function parseErrorFromPayload(payload: unknown, fallback: string) {
  if (isRecord(payload) && typeof payload.error === "string") {
    return payload.error;
  }
  return fallback;
}
