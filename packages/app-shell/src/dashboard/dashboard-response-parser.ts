import type {
  DashboardBootstrapData,
  DashboardCrmData,
  DashboardOverviewShellData,
  DashboardProjectsData,
  DashboardTasksData,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDashboardProjectsData(value: unknown): value is DashboardProjectsData {
  return isRecord(value) && typeof value.generatedAt === "string" && isRecord(value.kpis)
    && isRecord(value.projects) && Array.isArray(value.projects.overdue);
}

function isDashboardCrmData(value: unknown): value is DashboardCrmData {
  return isRecord(value) && typeof value.generatedAt === "string" && isRecord(value.kpis)
    && isRecord(value.crm) && Array.isArray(value.crm.recentChanges)
    && Array.isArray(value.crm.recentContacts) && isRecord(value.crm.statusBreakdown);
}

function isDashboardTasksData(value: unknown): value is DashboardTasksData {
  return isRecord(value) && typeof value.generatedAt === "string" && isRecord(value.kpis) && Array.isArray(value.tasks);
}

function unwrapPayload(payload: unknown) {
  return isRecord(payload) && "data" in payload ? payload : { data: payload };
}

export function parseDashboardProjectsResponse(payload: unknown) {
  const value = unwrapPayload(payload);
  return { data: isDashboardProjectsData(value.data) ? value.data : null, error: typeof value.error === "string" ? value.error : null };
}

export function parseDashboardCrmResponse(payload: unknown) {
  const value = unwrapPayload(payload);
  return { data: isDashboardCrmData(value.data) ? value.data : null, error: typeof value.error === "string" ? value.error : null };
}

export function parseDashboardTasksResponse(payload: unknown) {
  const value = unwrapPayload(payload);
  return { data: isDashboardTasksData(value.data) ? value.data : null, error: typeof value.error === "string" ? value.error : null };
}

export function parseDashboardBootstrapResponse(payload: unknown) {
  const value = unwrapPayload(payload);
  const data = isRecord(value.data) && isDashboardProjectsData(value.data.projects)
    && isDashboardCrmData(value.data.crm) && isDashboardTasksData(value.data.tasks)
    ? value.data as DashboardBootstrapData : null;
  return { data, error: typeof value.error === "string" ? value.error : null };
}

export function parseDashboardOverviewShellResponse(payload: unknown) {
  const value = unwrapPayload(payload);
  const data = isRecord(value.data) && isDashboardProjectsData(value.data.projects) && isDashboardCrmData(value.data.crm)
    ? value.data as DashboardOverviewShellData : null;
  return { data, error: typeof value.error === "string" ? value.error : null };
}

export function parseErrorFromPayload(payload: unknown, fallback: string) {
  const value = unwrapPayload(payload);
  return typeof value.error === "string" ? value.error : fallback;
}
