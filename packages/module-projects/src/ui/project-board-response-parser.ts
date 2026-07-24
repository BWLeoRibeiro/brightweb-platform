import type { ProjectTask } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseProjectBoardApiError(payload: unknown, fallback: string) {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) return payload.error;
  return fallback;
}

function isTaskItem(value: unknown): value is ProjectTask {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.title === "string" && typeof value.status === "string";
}

export function parseTaskListPayload(payload: unknown): ProjectTask[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return null;
  return payload.data.every(isTaskItem) ? (payload.data as ProjectTask[]) : null;
}
