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

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function hasCounts(value: unknown, keys: string[]) {
  return isRecord(value) && keys.every((key) => isCount(value[key]));
}

function isDashboardProjectItem(value: unknown) {
  return isRecord(value)
    && isString(value.id)
    && isString(value.organizationName)
    && isString(value.name)
    && isNullableString(value.code)
    && isOneOf(value.status, ["planned", "active", "blocked", "completed", "canceled"])
    && isOneOf(value.health, ["on_track", "at_risk", "off_track"])
    && isNullableString(value.ownerLabel)
    && isNullableString(value.targetDate)
    && hasCounts(value.taskStats, ["total", "done", "overdue", "blocked"]);
}

function isDashboardProjectsData(value: unknown): value is DashboardProjectsData {
  return isRecord(value)
    && isString(value.generatedAt)
    && hasCounts(value.kpis, [
      "projectsActive",
      "projectsAtRisk",
      "projectsOverdue",
      "projectsDueNext7Days",
      "projectsWithoutOwner",
      "projectBlockedTasks",
    ])
    && isRecord(value.projects)
    && Array.isArray(value.projects.overdue)
    && value.projects.overdue.every(isDashboardProjectItem);
}

function isDashboardCrmRecentChange(value: unknown) {
  return isRecord(value)
    && isString(value.id)
    && isString(value.contactId)
    && isString(value.contactLabel)
    && isNullableString(value.previousStatus)
    && isNullableString(value.newStatus)
    && isString(value.changedAt);
}

function isDashboardCrmRecentContact(value: unknown) {
  return isRecord(value)
    && isString(value.id)
    && isString(value.name)
    && isNullableString(value.company)
    && isString(value.status)
    && isString(value.lastChangedAt);
}

function isDashboardCrmData(value: unknown): value is DashboardCrmData {
  return isRecord(value)
    && isString(value.generatedAt)
    && hasCounts(value.kpis, [
      "crmTotalContacts",
      "crmNewLast7Days",
      "crmNewLast30Days",
      "crmNewLastYear",
      "crmUnassignedContacts",
    ])
    && isRecord(value.crm)
    && hasCounts(value.crm.statusBreakdown, ["lead", "qualified", "proposal", "won", "lost"])
    && Array.isArray(value.crm.recentChanges)
    && value.crm.recentChanges.every(isDashboardCrmRecentChange)
    && Array.isArray(value.crm.recentContacts)
    && value.crm.recentContacts.every(isDashboardCrmRecentContact);
}

function isDashboardAssignedTask(value: unknown) {
  return isRecord(value)
    && isString(value.id)
    && isString(value.projectId)
    && isString(value.projectName)
    && isNullableString(value.projectCode)
    && isString(value.title)
    && isOneOf(value.status, ["todo", "in_progress", "blocked", "done"])
    && isOneOf(value.priority, ["low", "medium", "high", "urgent"])
    && isNullableString(value.dueDate)
    && isNullableString(value.blockedReason)
    && isNullableString(value.milestoneId)
    && isString(value.updatedAt);
}

function isDashboardTasksData(value: unknown): value is DashboardTasksData {
  return isRecord(value)
    && isString(value.generatedAt)
    && hasCounts(value.kpis, ["total", "dueThisWeek", "overdue", "blocked"])
    && Array.isArray(value.tasks)
    && value.tasks.every(isDashboardAssignedTask);
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
