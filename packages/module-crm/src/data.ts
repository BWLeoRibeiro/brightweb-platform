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
};

export type CrmContactStatusStats = {
  total: number;
  byStatus: Record<string, number>;
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

export type CrmContactSort = "date_desc" | "name" | "company";

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

type RawCrmStatusLog = Omit<CrmStatusLog, "changed_by_label" | "contact_label">;

type CrmChangedByProfile = {
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

export const CRM_CONTACTS_DEFAULT_PAGE_SIZE = 50;
export const CRM_CONTACTS_MAX_PAGE_SIZE = 100;
export const CRM_PRIMARY_CONTACTS_DEFAULT_LIMIT = 200;
export const CRM_STATUS_TIMELINE_DEFAULT_LIMIT = 10;
export const CRM_STATUS_TIMELINE_DEFAULT_DAYS = 7;
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

function normalizeLimit(limit: number | undefined, fallback: number) {
  return Number.isFinite(limit) && (limit ?? 0) > 0 ? Math.floor(limit as number) : fallback;
}

function normalizeSince(value: Date | string | undefined) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  const since = new Date();
  since.setDate(since.getDate() - CRM_STATUS_TIMELINE_DEFAULT_DAYS);
  return since.toISOString();
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
  const [totalResult, ...statusResults] = await Promise.all([
    supabase.from("crm_contacts").select("id", { count: "exact", head: true }),
    ...CRM_CONTACT_STATUSES.map((status) =>
      supabase
        .from("crm_contacts")
        .select("id", { count: "exact", head: true })
        .eq("status", status),
    ),
  ]);

  const aggregateError = [totalResult, ...statusResults].find((result) => result.error)?.error;
  if (aggregateError) {
    throw new Error(aggregateError.message);
  }

  return {
    total: totalResult.count ?? 0,
    byStatus: CRM_CONTACT_STATUSES.reduce<Record<string, number>>((acc, status, index) => {
      acc[status] = statusResults[index]?.count ?? 0;
      return acc;
    }, {}),
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
  const limit = normalizeLimit(params.limit, CRM_STATUS_TIMELINE_DEFAULT_LIMIT);
  const since = normalizeSince(params.since);
  let query = supabase
    .from("crm_status_log")
    .select("id, contact_id, previous_status, new_status, reason, changed_at, changed_by_user_id")
    .gte("changed_at", since)
    .order("changed_at", { ascending: false });

  if (params.contactId?.trim()) query = query.eq("contact_id", params.contactId.trim());
  const { data, error } = await query.limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const statusLog = (data ?? []) as RawCrmStatusLog[];
  const contactIds = Array.from(new Set(statusLog.map((entry) => entry.contact_id).filter(Boolean)));
  const changedByIds = Array.from(
    new Set(statusLog.map((entry) => entry.changed_by_user_id).filter((value): value is string => Boolean(value))),
  );

  const contactMap = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data: contacts, error: contactsError } = await supabase
      .from("crm_contacts")
      .select("id, first_name, last_name, email")
      .in("id", contactIds);

    if (contactsError) {
      throw new Error(contactsError.message);
    }

    ((contacts ?? []) as Array<Pick<CrmContact, "id" | "first_name" | "last_name" | "email">>).forEach((contact) => {
      contactMap.set(contact.id, buildContactDisplayName(contact));
    });
  }

  const changedByMap = new Map<string, string>();
  if (changedByIds.length > 0) {
    const { data: changedByProfiles, error: changedByProfilesError } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", changedByIds);

    if (changedByProfilesError) {
      throw new Error(changedByProfilesError.message);
    }

    ((changedByProfiles ?? []) as CrmChangedByProfile[]).forEach((profile) => {
      const userId = profile.user_id;
      const label = buildProfileDisplayName(profile);
      if (userId && label) {
        changedByMap.set(userId, label);
      }
    });
  }

  return statusLog.map((entry) => ({
    ...entry,
    contact_label: contactMap.get(entry.contact_id) ?? "Contacto",
    changed_by_label: entry.changed_by_user_id ? (changedByMap.get(entry.changed_by_user_id) ?? null) : null,
  }));
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
      .order("updated_at", { ascending: false }),
    supabase
      .from("organizations")
      .select("id, name, industry, website_url")
      .order("created_at", { ascending: false }),
    listCrmStatusTimeline(supabase, { limit: 12, since: "1970-01-01T00:00:00.000Z" }),
  ]);

  if (contactsResult.error) throw new Error(contactsResult.error.message);
  if (organizationsResult.error) throw new Error(organizationsResult.error.message);

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
