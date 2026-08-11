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

function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || isNullableString(value);
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
    && isOneOf(value.status, ["planned", "active", "paused", "blocked", "completed", "canceled"])
    && isOneOf(value.health, ["on_track", "at_risk", "off_track"])
    && isNullableString(value.ownerLabel)
    && isNullableString(value.targetDate)
    && hasCounts(value.taskStats, ["total", "done", "overdue", "blocked"]);
}

function isDashboardProjectAttentionItem(value: unknown) {
  return isRecord(value)
    && isDashboardProjectItem(value)
    && isOneOf(value.attentionReason, ["overdue", "at_risk", "blocked_tasks", "without_owner", "due_soon"]);
}

function isDashboardProjectMilestone(value: unknown) {
  return isRecord(value)
    && isString(value.id)
    && isString(value.projectId)
    && isString(value.projectName)
    && isNullableString(value.projectCode)
    && isString(value.title)
    && isOneOf(value.status, ["pending", "in_progress", "delayed"])
    && isString(value.targetDate);
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
      "projectsAttention",
      "projectsOnTrack",
    ])
    && isRecord(value.projects)
    && Array.isArray(value.projects.overdue)
    && value.projects.overdue.every(isDashboardProjectItem)
    && Array.isArray(value.projects.attention)
    && value.projects.attention.every(isDashboardProjectAttentionItem)
    && Array.isArray(value.projects.milestones)
    && value.projects.milestones.every(isDashboardProjectMilestone)
    && (value.projects.milestonesNext7Days === undefined
      || (Array.isArray(value.projects.milestonesNext7Days)
        && value.projects.milestonesNext7Days.every(isDashboardProjectMilestone)));
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
    && isString(value.lastChangedAt)
    && isOptionalNullableString(value.createdAt);
}

function isDashboardCrmMonthlyPoint(value: unknown) {
  return isRecord(value)
    && typeof value.month === "string"
    && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value.month)
    && isCount(value.count);
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
    && value.crm.recentContacts.every(isDashboardCrmRecentContact)
    && (value.crm.monthlyNewContacts === undefined
      || (Array.isArray(value.crm.monthlyNewContacts)
        && value.crm.monthlyNewContacts.every(isDashboardCrmMonthlyPoint)));
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
    && value.tasks.every(isDashboardAssignedTask)
    && isRecord(value.attention)
    && isCount(value.attention.total)
    && Array.isArray(value.attention.tasks)
    && value.attention.tasks.every(isDashboardAssignedTask)
    && isRecord(value.pagination)
    && isCount(value.pagination.page)
    && value.pagination.page >= 1
    && isCount(value.pagination.pageSize)
    && value.pagination.pageSize >= 1
    && typeof value.pagination.hasMore === "boolean";
}

function readErrorMessage(value: unknown): string | null {
  if (isString(value)) return value;
  if (isRecord(value) && isString(value.message)) return value.message;
  return null;
}

function unwrapPayload(payload: unknown) {
  return isRecord(payload) && ("data" in payload || "error" in payload) ? payload : { data: payload };
}

export function parseDashboardProjectsResponse(payload: unknown) {
  const value = unwrapPayload(payload);
  return { data: isDashboardProjectsData(value.data) ? value.data : null, error: readErrorMessage(value.error) };
}

export function parseDashboardCrmResponse(payload: unknown) {
  const value = unwrapPayload(payload);
  return { data: isDashboardCrmData(value.data) ? value.data : null, error: readErrorMessage(value.error) };
}

export function parseDashboardTasksResponse(payload: unknown) {
  const value = unwrapPayload(payload);
  return { data: isDashboardTasksData(value.data) ? value.data : null, error: readErrorMessage(value.error) };
}

export function parseDashboardBootstrapResponse(payload: unknown) {
  const value = unwrapPayload(payload);
  const data = isRecord(value.data) && isDashboardProjectsData(value.data.projects)
    && isDashboardCrmData(value.data.crm) && isDashboardTasksData(value.data.tasks)
    ? value.data as DashboardBootstrapData : null;
  return { data, error: readErrorMessage(value.error) };
}

export function parseDashboardOverviewShellResponse(payload: unknown) {
  const value = unwrapPayload(payload);
  const data = isRecord(value.data) && isDashboardProjectsData(value.data.projects) && isDashboardCrmData(value.data.crm)
    ? value.data as DashboardOverviewShellData : null;
  return { data, error: readErrorMessage(value.error) };
}

export function parseErrorFromPayload(payload: unknown, fallback: string) {
  const value = unwrapPayload(payload);
  return readErrorMessage(value.error) ?? fallback;
}
