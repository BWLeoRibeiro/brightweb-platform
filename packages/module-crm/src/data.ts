import type { SupabaseClient } from "@supabase/supabase-js";

/** @deprecated Import organization helpers and types from @brightweblabs/module-orgs. */
export {
  ORGANIZATIONS_DEFAULT_PAGE_SIZE as CRM_ORGANIZATIONS_DEFAULT_PAGE_SIZE,
  ORGANIZATIONS_MAX_PAGE_SIZE as CRM_ORGANIZATIONS_MAX_PAGE_SIZE,
  listOrganizations as listCrmOrganizations,
  type Organization as CrmOrganization,
  type OrganizationsListParams as CrmOrganizationsListParams,
  type OrganizationsListResult as CrmOrganizationsListResult,
} from "@brightweblabs/module-orgs";

export type CrmContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  owner_id: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  organizations?: { name: string | null } | null;
};

export type CrmPrimaryContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type CrmOwnerOption = {
  id: string;
  label: string;
  email: string | null;
  role: "staff" | "admin";
};

export type CrmStatusLog = {
  id: string;
  contact_id: string;
  previous_status: string | null;
  new_status: string;
  reason: string | null;
  changed_at: string;
  changed_by_user_id: string | null;
  changed_by_label: string | null;
  contact_label: string;
  /** Canonical activity metadata. Optional to preserve the existing public shape. */
  event_type?: "crm_contact_status_changed" | "crm_contact_deleted";
  summary?: string;
  payload?: Record<string, unknown>;
};

export type CrmContactStatusStats = {
  total: number;
  byStatus: Record<string, number>;
  activity?: {
    qualifiedLast30Days: number;
    wonLast30Days: number;
    newLast7Days: number;
    newLast30Days: number;
    newLastYear: number;
  };
};

export type CrmReportData = {
  generatedAt: string;
  summary: {
    totalContacts: number;
    qualifiedContacts: number;
    qualificationRate: number;
    wonContacts: number;
    lostContacts: number;
    closedDeals: number;
    winRate: number;
    contactsWithOrganization: number;
    organizationCoverage: number;
  };
  byStatus: Array<{ status: string; label: string; count: number; share: number }>;
  bySource: Array<{ source: string; label: string; count: number; share: number }>;
  byOwner: Array<{ ownerId: string | null; label: string; count: number; share: number }>;
  organizationCoverage: {
    totalOrganizations: number;
    organizationsWithContacts: number;
    organizationsWithoutContacts: number;
    share: number;
    topOrganizations: Array<{
      organizationId: string;
      name: string;
      industry: string | null;
      websiteUrl: string | null;
      contactCount: number;
    }>;
  };
  recentActivity: Array<{
    id: string;
    contactLabel: string;
    previousStatus: string | null;
    newStatus: string;
    reason: string | null;
    changedAt: string;
    changedBy: string;
  }>;
};

export type CrmPrimaryContactsListParams = {
  limit?: number;
};

export type CrmPrimaryContactsData = CrmPrimaryContact[];

export type CrmStatusTimelineParams = {
  since?: Date | string;
  limit?: number;
  contactId?: string;
  search?: string;
  eventTypes?: Array<"crm_contact_status_changed" | "crm_contact_deleted">;
};

export type CrmStatusTimelineData = CrmStatusLog[];

export type CrmContactsListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string | null;
  organizationId?: string | null;
  ownerProfileId?: string | null;
  sort?: CrmContactSort;
};

export type CrmContactSort = "date_desc" | "name" | "company" | "status_grouped" | "source_grouped";

export type CrmContactsListResult = {
  items: CrmContact[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type CrmOwnerAssignment = {
  profile_id: string | null;
  role_code: string | null;
  profile:
    | {
      id?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    }
    | Array<{
      id?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    }>
    | null;
};

type RawCrmTimelineEvent = {
  id: string;
  entity_id: string | null;
  created_at: string;
  event_type: "crm_contact_status_changed" | "crm_contact_deleted";
  actor_profile_id: string | null;
  summary: string;
  payload: Record<string, unknown> | null;
};

type CrmTimelineActorProfile = {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

export const CRM_CONTACTS_DEFAULT_PAGE_SIZE = 50;
export const CRM_CONTACTS_MAX_PAGE_SIZE = 100;
export const CRM_PRIMARY_CONTACTS_DEFAULT_LIMIT = 200;
export const CRM_STATUS_TIMELINE_DEFAULT_LIMIT = 10;
export const CRM_STATUS_TIMELINE_MAX_LIMIT = 100;
export const CRM_STATUS_TIMELINE_DEFAULT_DAYS = 7;
export const CRM_STATUS_TIMELINE_MAX_DAYS = 365;
export const CRM_REPORT_MAX_RECORDS = 5_000;
export const CRM_CONTACT_STATUSES = ["lead", "qualified", "proposal", "won", "lost"] as const;

function normalizePage(page: number | undefined, fallback: number) {
  return Number.isFinite(page) && (page ?? 0) > 0 ? Math.floor(page as number) : fallback;
}

function normalizePageSize(pageSize: number | undefined, fallback: number, max: number) {
  const normalized = Number.isFinite(pageSize) && (pageSize ?? 0) > 0 ? Math.floor(pageSize as number) : fallback;
  return Math.min(normalized, max);
}

function buildProfileDisplayName(profile: {
  first_name?: string | null;
  last_name?: string | null;
}) {
  const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const combinedFirstLast = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  const safeCombinedFirstLast = combinedFirstLast && !isEmailLike(combinedFirstLast) ? combinedFirstLast : "";
  return safeCombinedFirstLast || null;
}

function buildContactDisplayName(contact: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Contacto";
}

function normalizeLimit(limit: number | undefined, fallback: number, max = Number.POSITIVE_INFINITY) {
  const normalized = Number.isFinite(limit) && (limit ?? 0) > 0 ? Math.floor(limit as number) : fallback;
  return Math.min(normalized, max);
}

function normalizeSince(value: Date | string | undefined) {
  const now = Date.now();
  const fallback = new Date(now - CRM_STATUS_TIMELINE_DEFAULT_DAYS * 86_400_000);
  const earliest = now - CRM_STATUS_TIMELINE_MAX_DAYS * 86_400_000;
  const parsed = value instanceof Date
    ? value
    : typeof value === "string" && value.trim()
      ? new Date(value)
      : fallback;
  const timestamp = parsed.getTime();
  if (!Number.isFinite(timestamp) || timestamp > now) return fallback.toISOString();
  return new Date(Math.max(timestamp, earliest)).toISOString();
}

export function normalizeCrmContact(
  contact: CrmContact | (Omit<CrmContact, "organizations"> & {
    organizations?: Array<{ name: string | null }> | { name: string | null } | null;
  }),
): CrmContact {
  return {
    ...contact,
    organizations: Array.isArray(contact.organizations)
      ? contact.organizations[0] ?? null
      : contact.organizations ?? null,
  };
}

export async function listCrmContacts(
  supabase: SupabaseClient,
  params: CrmContactsListParams = {},
): Promise<CrmContactsListResult> {
  const page = normalizePage(params.page, 1);
  const pageSize = normalizePageSize(params.pageSize, CRM_CONTACTS_DEFAULT_PAGE_SIZE, CRM_CONTACTS_MAX_PAGE_SIZE);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = params.search?.trim() ?? "";

  let query = supabase
    .from("crm_contacts")
    .select(
      "id, first_name, last_name, email, phone, status, source, owner_id, organization_id, created_at, updated_at, organizations(name)",
      { count: "exact" },
    );

  if (params.sort === "name") {
    query = query.order("first_name", { ascending: true }).order("last_name", { ascending: true });
  } else if (params.sort === "company") {
    query = query.order("name", { ascending: true, foreignTable: "organizations" });
  } else if (params.sort === "status_grouped") {
    query = query.order("status", { ascending: true }).order("updated_at", { ascending: false });
  } else if (params.sort === "source_grouped") {
    query = query.order("source", { ascending: true, nullsFirst: false }).order("updated_at", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  query = query.range(from, to);

  if (search) {
    const safe = search.replace(/[%_,()"]/g, "");
    const pattern = `%${safe}%`;
    query = query.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
  }

  if (params.status?.trim()) {
    query = query.eq("status", params.status.trim());
  }

  if (params.organizationId) {
    query = query.eq("organization_id", params.organizationId);
  }

  if (params.ownerProfileId) {
    query = query.eq("owner_id", params.ownerProfileId);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const items = ((data ?? []) as Array<CrmContact | (Omit<CrmContact, "organizations"> & {
    organizations?: Array<{ name: string | null }> | { name: string | null } | null;
  })>).map(normalizeCrmContact);

  return {
    items,
    page,
    pageSize,
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function getCrmContactStatusStats(
  supabase: SupabaseClient,
): Promise<CrmContactStatusStats> {
  if (typeof supabase.rpc === "function") {
    const { data, error } = await supabase.rpc("get_crm_contact_stats");
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== "object") {
        return { total: 0, byStatus: {}, activity: { qualifiedLast30Days: 0, wonLast30Days: 0, newLast7Days: 0, newLast30Days: 0, newLastYear: 0 } };
      }
      const value = row as Record<string, unknown>;
      return {
        total: Number(value.total_count ?? 0),
        byStatus: {
          lead: Number(value.lead_count ?? 0),
          qualified: Number(value.qualified_count ?? 0),
          proposal: Number(value.proposal_count ?? 0),
          won: Number(value.won_count ?? 0),
          lost: Number(value.lost_count ?? 0),
        },
        activity: {
          qualifiedLast30Days: Number(value.qualified_last_30_days ?? 0),
          wonLast30Days: Number(value.won_last_30_days ?? 0),
          newLast7Days: Number(value.new_last_7_days ?? 0),
          newLast30Days: Number(value.new_last_30_days ?? 0),
          newLastYear: Number(value.new_last_year ?? 0),
        },
      };
    }
    if (error.code !== "42883" && error.code !== "PGRST202") {
      throw new Error(error.message);
    }
  }

  // Compatibility path for applications that upgraded the package before
  // applying the accompanying database migration.
  const now = Date.now();
  const since = (days: number) => new Date(now - days * 86_400_000).toISOString();
  const [totalResult, ...remainingResults] = await Promise.all([
    supabase.from("crm_contacts").select("id", { count: "exact", head: true }),
    ...CRM_CONTACT_STATUSES.map((status) => supabase.from("crm_contacts").select("id", { count: "exact", head: true }).eq("status", status)),
    supabase.from("crm_status_log").select("id", { count: "exact", head: true }).eq("new_status", "qualified").gte("changed_at", since(30)),
    supabase.from("crm_status_log").select("id", { count: "exact", head: true }).eq("new_status", "won").gte("changed_at", since(30)),
    supabase.from("crm_contacts").select("id", { count: "exact", head: true }).gte("created_at", since(7)),
    supabase.from("crm_contacts").select("id", { count: "exact", head: true }).gte("created_at", since(30)),
    supabase.from("crm_contacts").select("id", { count: "exact", head: true }).gte("created_at", since(365)),
  ]);
  const statusResults = remainingResults.slice(0, CRM_CONTACT_STATUSES.length);
  const activityResults = remainingResults.slice(CRM_CONTACT_STATUSES.length);
  const aggregateError = [totalResult, ...remainingResults].find((result) => result.error)?.error;
  if (aggregateError) throw new Error(aggregateError.message);
  return {
    total: totalResult.count ?? 0,
    byStatus: CRM_CONTACT_STATUSES.reduce<Record<string, number>>((acc, status, index) => {
      acc[status] = statusResults[index]?.count ?? 0;
      return acc;
    }, {}),
    activity: {
      qualifiedLast30Days: activityResults[0]?.count ?? 0,
      wonLast30Days: activityResults[1]?.count ?? 0,
      newLast7Days: activityResults[2]?.count ?? 0,
      newLast30Days: activityResults[3]?.count ?? 0,
      newLastYear: activityResults[4]?.count ?? 0,
    },
  };
}

export async function listCrmOwnerOptions(
  supabase: SupabaseClient,
): Promise<CrmOwnerOption[]> {
  const { data, error } = await supabase
    .from("user_role_assignments")
    .select("profile_id, role_code, profile:profiles!user_role_assignments_profile_id_fkey(id, first_name, last_name, email)")
    .in("role_code", ["staff", "admin"])
    .order("assigned_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CrmOwnerAssignment[]).reduce<CrmOwnerOption[]>((acc, assignment) => {
    const roleCode = assignment.role_code;
    if (roleCode !== "staff" && roleCode !== "admin") return acc;
    if (typeof assignment.profile_id !== "string") return acc;
    if (acc.some((item) => item.id === assignment.profile_id)) return acc;

    const profileRaw = assignment.profile;
    const ownerProfile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw ?? null;
    if (!ownerProfile) return acc;

    const label = buildProfileDisplayName(ownerProfile) ?? ownerProfile.email ?? "Utilizador sem nome";
    const email = typeof ownerProfile.email === "string" ? ownerProfile.email : null;

    acc.push({
      id: assignment.profile_id,
      label,
      email,
      role: roleCode,
    });
    return acc;
  }, []);
}

export async function listCrmPrimaryContacts(
  supabase: SupabaseClient,
  params: CrmPrimaryContactsListParams = {},
): Promise<CrmPrimaryContactsData> {
  const limit = normalizeLimit(params.limit, CRM_PRIMARY_CONTACTS_DEFAULT_LIMIT);
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CrmPrimaryContact[];
}

export async function listCrmStatusTimeline(
  supabase: SupabaseClient,
  params: CrmStatusTimelineParams = {},
): Promise<CrmStatusTimelineData> {
  const limit = normalizeLimit(params.limit, CRM_STATUS_TIMELINE_DEFAULT_LIMIT, CRM_STATUS_TIMELINE_MAX_LIMIT);
  const since = normalizeSince(params.since);
  const search = params.search?.trim().toLocaleLowerCase();
  const eventTypes = params.eventTypes?.length
    ? params.eventTypes
    : ["crm_contact_status_changed", "crm_contact_deleted"];

  let query = supabase
    .from("app_activity_events")
    .select("id, entity_id, created_at, event_type, actor_profile_id, summary, payload")
    .eq("domain", "crm")
    .in("event_type", eventTypes)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (params.contactId?.trim()) query = query.eq("entity_id", params.contactId.trim());
  const { data, error } = await query.limit(search ? CRM_STATUS_TIMELINE_MAX_LIMIT : limit);

  if (error) {
    throw new Error(error.message);
  }

  const events = (data ?? []) as RawCrmTimelineEvent[];
  const actorProfileIds = Array.from(
    new Set(events.map((entry) => entry.actor_profile_id).filter((value): value is string => Boolean(value))),
  );

  const actorMap = new Map<string, { userId: string | null; label: string | null }>();
  if (actorProfileIds.length > 0) {
    const { data: changedByProfiles, error: changedByProfilesError } = await supabase
      .from("profiles")
      .select("id, user_id, first_name, last_name")
      .in("id", actorProfileIds);

    if (changedByProfilesError) {
      throw new Error(changedByProfilesError.message);
    }

    ((changedByProfiles ?? []) as CrmTimelineActorProfile[]).forEach((profile) => {
      actorMap.set(profile.id, { userId: profile.user_id, label: buildProfileDisplayName(profile) });
    });
  }

  const entries = events.map<CrmStatusLog>((event) => {
    const payload = event.payload ?? {};
    const changes = payload.changes && typeof payload.changes === "object" ? payload.changes as Record<string, unknown> : {};
    const status = changes.status && typeof changes.status === "object" ? changes.status as Record<string, unknown> : {};
    const actor = event.actor_profile_id ? actorMap.get(event.actor_profile_id) : undefined;
    return {
      id: event.id,
      contact_id: event.entity_id ?? (typeof payload.contact_id === "string" ? payload.contact_id : ""),
      previous_status: typeof status.from === "string" ? status.from : null,
      new_status: typeof status.to === "string" ? status.to : "",
      reason: typeof payload.reason === "string" ? payload.reason : null,
      changed_at: event.created_at,
      changed_by_user_id: actor?.userId ?? null,
      changed_by_label: actor?.label ?? null,
      contact_label: typeof payload.contact_name === "string" && payload.contact_name.trim() ? payload.contact_name : "Contacto",
      event_type: event.event_type,
      summary: event.summary,
      payload,
    };
  });

  if (!search) return entries;
  return entries.filter((entry) => [
    entry.contact_label,
    entry.changed_by_label,
    entry.reason,
    entry.summary,
    entry.previous_status,
    entry.new_status,
  ].filter((value): value is string => Boolean(value)).join(" ").toLocaleLowerCase().includes(search)).slice(0, limit);
}

function reportPercentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function reportSource(value: string | null) {
  return value?.trim().toLowerCase() || "manual";
}

export async function getCrmReportData(supabase: SupabaseClient): Promise<CrmReportData> {
  const [contactsResult, organizationsResult, timeline] = await Promise.all([
    supabase
      .from("crm_contacts")
      .select("id, first_name, last_name, email, status, source, owner_id, organization_id")
      .order("updated_at", { ascending: false })
      .limit(CRM_REPORT_MAX_RECORDS + 1),
    supabase
      .from("organizations")
      .select("id, name, industry, website_url")
      .order("created_at", { ascending: false })
      .limit(CRM_REPORT_MAX_RECORDS + 1),
    listCrmStatusTimeline(supabase, {
      limit: 12,
      since: "1970-01-01T00:00:00.000Z",
      eventTypes: ["crm_contact_status_changed"],
    }),
  ]);

  if (contactsResult.error) throw new Error(contactsResult.error.message);
  if (organizationsResult.error) throw new Error(organizationsResult.error.message);
  if ((contactsResult.data?.length ?? 0) > CRM_REPORT_MAX_RECORDS) throw new Error("CRM_REPORT_TOO_LARGE");
  if ((organizationsResult.data?.length ?? 0) > CRM_REPORT_MAX_RECORDS) throw new Error("CRM_REPORT_TOO_LARGE");

  type ReportContact = Pick<CrmContact, "id" | "first_name" | "last_name" | "email" | "status" | "source" | "owner_id" | "organization_id">;
  type ReportOrganization = { id: string; name: string; industry: string | null; website_url: string | null };
  const contacts = (contactsResult.data ?? []) as ReportContact[];
  const organizations = (organizationsResult.data ?? []) as ReportOrganization[];
  const totalContacts = contacts.length;
  const qualifiedContacts = contacts.filter((contact) => ["qualified", "proposal", "won"].includes(contact.status)).length;
  const wonContacts = contacts.filter((contact) => contact.status === "won").length;
  const lostContacts = contacts.filter((contact) => contact.status === "lost").length;
  const closedDeals = wonContacts + lostContacts;
  const contactsWithOrganization = contacts.filter((contact) => Boolean(contact.organization_id)).length;
  const statusLabels: Record<string, string> = {
    lead: "Novo",
    qualified: "Qualificado",
    proposal: "Proposta",
    won: "Ganho",
    lost: "Perdido",
  };
  const byStatus = CRM_CONTACT_STATUSES.map((status) => {
    const count = contacts.filter((contact) => (contact.status || "lead") === status).length;
    return { status, label: statusLabels[status] ?? status, count, share: reportPercentage(count, totalContacts) };
  });

  const sourceCounts = new Map<string, number>();
  const ownerCounts = new Map<string | null, number>();
  const organizationCounts = new Map<string, number>();
  contacts.forEach((contact) => {
    const source = reportSource(contact.source);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    const ownerId = contact.owner_id ?? null;
    ownerCounts.set(ownerId, (ownerCounts.get(ownerId) ?? 0) + 1);
    if (contact.organization_id) organizationCounts.set(contact.organization_id, (organizationCounts.get(contact.organization_id) ?? 0) + 1);
  });

  const ownerIds = Array.from(ownerCounts.keys()).filter((value): value is string => Boolean(value));
  const ownerProfilesResult = ownerIds.length > 0
    ? await supabase.from("profiles").select("id, first_name, last_name, email").in("id", ownerIds)
    : { data: [], error: null };
  if (ownerProfilesResult.error) throw new Error(ownerProfilesResult.error.message);
  const ownerMap = new Map(((ownerProfilesResult.data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>).map((profile) => [profile.id, profile]));

  const bySource = Array.from(sourceCounts, ([source, count]) => ({
    source,
    label: source.replaceAll("_", " "),
    count,
    share: reportPercentage(count, totalContacts),
  })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "pt-PT"));
  const byOwner = Array.from(ownerCounts, ([ownerId, count]) => {
    const profile = ownerId ? ownerMap.get(ownerId) : undefined;
    const label = !ownerId
      ? "Sem responsável"
      : profile
        ? buildProfileDisplayName(profile) ?? profile.email ?? "Responsável desconhecido"
        : "Responsável desconhecido";
    return { ownerId, label, count, share: reportPercentage(count, totalContacts) };
  }).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "pt-PT"));

  const organizationIds = new Set(organizations.map((organization) => organization.id));
  const organizationsWithContacts = Array.from(organizationCounts.keys()).filter((id) => organizationIds.has(id)).length;
  const topOrganizations = organizations
    .map((organization) => ({
      organizationId: organization.id,
      name: organization.name,
      industry: organization.industry,
      websiteUrl: organization.website_url,
      contactCount: organizationCounts.get(organization.id) ?? 0,
    }))
    .filter((organization) => organization.contactCount > 0)
    .sort((left, right) => right.contactCount - left.contactCount || left.name.localeCompare(right.name, "pt-PT"))
    .slice(0, 6);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalContacts,
      qualifiedContacts,
      qualificationRate: reportPercentage(qualifiedContacts, totalContacts),
      wonContacts,
      lostContacts,
      closedDeals,
      winRate: reportPercentage(wonContacts, closedDeals),
      contactsWithOrganization,
      organizationCoverage: reportPercentage(contactsWithOrganization, totalContacts),
    },
    byStatus,
    bySource,
    byOwner,
    organizationCoverage: {
      totalOrganizations: organizations.length,
      organizationsWithContacts,
      organizationsWithoutContacts: Math.max(organizations.length - organizationsWithContacts, 0),
      share: reportPercentage(organizationsWithContacts, organizations.length),
      topOrganizations,
    },
    recentActivity: timeline.map((entry) => ({
      id: entry.id,
      contactLabel: entry.contact_label,
      previousStatus: entry.previous_status,
      newStatus: entry.new_status,
      reason: entry.reason,
      changedAt: entry.changed_at,
      changedBy: entry.changed_by_label ?? "Sistema",
    })),
  };
}
