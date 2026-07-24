import type {
  CrmContact,
  CrmContactStatusStats,
  CrmContactsListResult,
  CrmOwnerOption,
  CrmReportData,
  CrmStatusLog,
} from "../data";
import type { CrmOrganization } from "./types";

type RecordValue = Record<string, unknown>;

function record(value: unknown, label: string): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Invalid ${label} response.`);
  return value as RecordValue;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`Invalid ${label} response.`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value !== null && typeof value !== "string") throw new Error(`Invalid ${label} response.`);
  return value as string | null;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ${label} response.`);
  return value;
}

function array<T>(value: unknown, parser: (item: unknown) => T, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label} response.`);
  return value.map(parser);
}

function parseContact(value: unknown): CrmContact {
  const item = record(value, "CRM contact");
  const organization = item.organizations == null
    ? null
    : { name: nullableString(record(item.organizations, "CRM contact organization").name, "CRM contact organization") };
  return {
    id: string(item.id, "CRM contact"),
    first_name: nullableString(item.first_name, "CRM contact"),
    last_name: nullableString(item.last_name, "CRM contact"),
    email: nullableString(item.email, "CRM contact"),
    phone: nullableString(item.phone, "CRM contact"),
    status: string(item.status, "CRM contact"),
    source: nullableString(item.source, "CRM contact"),
    owner_id: nullableString(item.owner_id, "CRM contact"),
    organization_id: nullableString(item.organization_id, "CRM contact"),
    created_at: string(item.created_at, "CRM contact"),
    updated_at: string(item.updated_at, "CRM contact"),
    organizations: organization,
  };
}

export function parseCrmContactsResponse(value: unknown): CrmContactsListResult {
  const payload = record(value, "CRM contacts");
  return {
    items: array(payload.items, parseContact, "CRM contacts"),
    page: number(payload.page, "CRM contacts"),
    pageSize: number(payload.pageSize, "CRM contacts"),
    total: number(payload.total, "CRM contacts"),
    totalPages: number(payload.totalPages, "CRM contacts"),
  };
}

export function parseCrmStatsResponse(value: unknown): CrmContactStatusStats {
  const payload = record(value, "CRM stats");
  const rawByStatus = record(payload.byStatus, "CRM stats");
  const byStatus = Object.fromEntries(
    Object.entries(rawByStatus).map(([status, count]) => [status, number(count, "CRM stats")]),
  );
  return { total: number(payload.total, "CRM stats"), byStatus };
}

export function parseCrmOwnersResponse(value: unknown): CrmOwnerOption[] {
  return array(value, (ownerValue) => {
    const owner = record(ownerValue, "CRM owner");
    if (owner.role !== "staff" && owner.role !== "admin") throw new Error("Invalid CRM owner response.");
    return {
      id: string(owner.id, "CRM owner"),
      label: string(owner.label, "CRM owner"),
      email: nullableString(owner.email, "CRM owner"),
      role: owner.role,
    };
  }, "CRM owners");
}

function parseOrganization(value: unknown): CrmOrganization {
  const item = record(value, "CRM organization");
  const result: CrmOrganization = {
    id: string(item.id, "CRM organization"),
    name: nullableString(item.name, "CRM organization"),
  };
  for (const key of [
    "industry",
    "company_size",
    "budget_range",
    "website_url",
    "address",
    "taxIdentifierValue",
    "primary_contact_id",
  ] as const) {
    if (Object.hasOwn(item, key)) result[key] = nullableString(item[key], "CRM organization");
  }
  if (Object.hasOwn(item, "created_at")) result.created_at = string(item.created_at, "CRM organization");
  return result;
}

export function parseCrmOrganizationsResponse(value: unknown): CrmOrganization[] {
  const payload = record(value, "CRM organizations");
  return array(payload.items, parseOrganization, "CRM organizations");
}

export function parseCrmOrganizationWriteResponse(value: unknown): CrmOrganization {
  const payload = record(value, "CRM organization write");
  return parseOrganization(record(payload.data, "CRM organization write").organization);
}

function parseTimelineItem(value: unknown): CrmStatusLog {
  const item = record(value, "CRM timeline item");
  return {
    id: string(item.id, "CRM timeline item"),
    contact_id: string(item.contact_id, "CRM timeline item"),
    previous_status: nullableString(item.previous_status, "CRM timeline item"),
    new_status: string(item.new_status, "CRM timeline item"),
    reason: nullableString(item.reason, "CRM timeline item"),
    changed_at: string(item.changed_at, "CRM timeline item"),
    changed_by_user_id: nullableString(item.changed_by_user_id, "CRM timeline item"),
    changed_by_label: nullableString(item.changed_by_label, "CRM timeline item"),
    contact_label: string(item.contact_label, "CRM timeline item"),
  };
}

export function parseCrmTimelineResponse(value: unknown): CrmStatusLog[] {
  return array(value, parseTimelineItem, "CRM timeline");
}

function parseCountShare(value: unknown, label: string) {
  const item = record(value, label);
  return { count: number(item.count, label), share: number(item.share, label) };
}

export function parseCrmReportResponse(value: unknown): CrmReportData {
  const payload = record(value, "CRM report");
  const summary = record(payload.summary, "CRM report summary");
  const coverage = record(payload.organizationCoverage, "CRM report organization coverage");
  return {
    generatedAt: string(payload.generatedAt, "CRM report"),
    summary: {
      totalContacts: number(summary.totalContacts, "CRM report summary"),
      qualifiedContacts: number(summary.qualifiedContacts, "CRM report summary"),
      qualificationRate: number(summary.qualificationRate, "CRM report summary"),
      wonContacts: number(summary.wonContacts, "CRM report summary"),
      lostContacts: number(summary.lostContacts, "CRM report summary"),
      closedDeals: number(summary.closedDeals, "CRM report summary"),
      winRate: number(summary.winRate, "CRM report summary"),
      contactsWithOrganization: number(summary.contactsWithOrganization, "CRM report summary"),
      organizationCoverage: number(summary.organizationCoverage, "CRM report summary"),
    },
    byStatus: array(payload.byStatus, (value) => {
      const item = record(value, "CRM report status");
      return {
        status: string(item.status, "CRM report status"),
        label: string(item.label, "CRM report status"),
        ...parseCountShare(item, "CRM report status"),
      };
    }, "CRM report statuses"),
    bySource: array(payload.bySource, (value) => {
      const item = record(value, "CRM report source");
      return {
        source: string(item.source, "CRM report source"),
        label: string(item.label, "CRM report source"),
        ...parseCountShare(item, "CRM report source"),
      };
    }, "CRM report sources"),
    byOwner: array(payload.byOwner, (value) => {
      const item = record(value, "CRM report owner");
      return {
        ownerId: nullableString(item.ownerId, "CRM report owner"),
        label: string(item.label, "CRM report owner"),
        ...parseCountShare(item, "CRM report owner"),
      };
    }, "CRM report owners"),
    organizationCoverage: {
      totalOrganizations: number(coverage.totalOrganizations, "CRM report organization coverage"),
      organizationsWithContacts: number(coverage.organizationsWithContacts, "CRM report organization coverage"),
      organizationsWithoutContacts: number(coverage.organizationsWithoutContacts, "CRM report organization coverage"),
      share: number(coverage.share, "CRM report organization coverage"),
      topOrganizations: array(coverage.topOrganizations, (value) => {
        const item = record(value, "CRM report organization");
        return {
          organizationId: string(item.organizationId, "CRM report organization"),
          name: string(item.name, "CRM report organization"),
          industry: nullableString(item.industry, "CRM report organization"),
          websiteUrl: nullableString(item.websiteUrl, "CRM report organization"),
          contactCount: number(item.contactCount, "CRM report organization"),
        };
      }, "CRM report organizations"),
    },
    recentActivity: array(payload.recentActivity, (value) => {
      const item = record(value, "CRM report activity");
      return {
        id: string(item.id, "CRM report activity"),
        contactLabel: string(item.contactLabel, "CRM report activity"),
        previousStatus: nullableString(item.previousStatus, "CRM report activity"),
        newStatus: string(item.newStatus, "CRM report activity"),
        reason: nullableString(item.reason, "CRM report activity"),
        changedAt: string(item.changedAt, "CRM report activity"),
        changedBy: string(item.changedBy, "CRM report activity"),
      };
    }, "CRM report activities"),
  };
}

export function parseCrmContactWriteResponse(value: unknown): CrmContact {
  const payload = record(value, "CRM contact write");
  return parseContact(record(payload.data, "CRM contact write").contact);
}

export function parseCrmBulkWriteResponse(value: unknown): void {
  const data = record(record(value, "CRM bulk write").data, "CRM bulk write");
  array(data.outcomes, (value) => {
    const outcome = record(value, "CRM bulk outcome");
    string(outcome.id, "CRM bulk outcome");
    if (typeof outcome.ok !== "boolean") throw new Error("Invalid CRM bulk outcome response.");
    if (!outcome.ok && outcome.code !== "CONTACT_NOT_FOUND" && outcome.code !== "WRITE_FAILED") {
      throw new Error("Invalid CRM bulk outcome response.");
    }
  }, "CRM bulk outcomes");
  const summary = record(data.summary, "CRM bulk summary");
  number(summary.requested, "CRM bulk summary");
  number(summary.succeeded, "CRM bulk summary");
  number(summary.failed, "CRM bulk summary");
}

export function parseCrmDeleteOrStatusResponse(value: unknown): void {
  const payload = record(value, "CRM write");
  const data = record(payload.data, "CRM write");
  if (Array.isArray(data.outcomes)) {
    parseCrmBulkWriteResponse(value);
    return;
  }
  if (Object.hasOwn(data, "contact") && data.contact !== null) parseContact(data.contact);
}
