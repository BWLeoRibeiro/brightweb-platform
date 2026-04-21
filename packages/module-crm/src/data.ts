import type { SupabaseClient } from "@supabase/supabase-js";

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

export type CrmOrganization = {
  id: string;
  name: string;
  industry: string | null;
  company_size: string | null;
  budget_range: string | null;
  website_url: string | null;
  address: string | null;
  taxIdentifierValue: string | null;
  primary_contact_id: string | null;
  primary_contact?: CrmPrimaryContact | null;
  created_at: string;
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

export type CrmPrimaryContactsListParams = {
  limit?: number;
};

export type CrmPrimaryContactsData = CrmPrimaryContact[];

export type CrmStatusTimelineParams = {
  since?: Date | string;
  limit?: number;
};

export type CrmStatusTimelineData = CrmStatusLog[];

export type CrmContactsListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string | null;
  organizationId?: string | null;
  ownerProfileId?: string | null;
};

export type CrmContactsListResult = {
  items: CrmContact[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CrmOrganizationsListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
};

export type CrmOrganizationsListResult = {
  items: CrmOrganization[];
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

type RawCrmOrganization = {
  id: string;
  name: string;
  industry: string | null;
  company_size: string | null;
  budget_range: string | null;
  website_url: string | null;
  address: string | null;
  tax_identifier_value?: string | null;
  primary_contact_id: string | null;
  primary_contact?:
    | CrmPrimaryContact
    | CrmPrimaryContact[]
    | null;
  created_at: string;
};

type RawCrmStatusLog = Omit<CrmStatusLog, "changed_by_label" | "contact_label">;

type CrmChangedByProfile = {
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

export const CRM_CONTACTS_DEFAULT_PAGE_SIZE = 50;
export const CRM_CONTACTS_MAX_PAGE_SIZE = 100;
export const CRM_ORGANIZATIONS_DEFAULT_PAGE_SIZE = 20;
export const CRM_ORGANIZATIONS_MAX_PAGE_SIZE = 100;
export const CRM_PRIMARY_CONTACTS_DEFAULT_LIMIT = 200;
export const CRM_STATUS_TIMELINE_DEFAULT_LIMIT = 10;
export const CRM_STATUS_TIMELINE_DEFAULT_DAYS = 7;

function normalizePage(page: number | undefined, fallback: number) {
  return Number.isFinite(page) && (page ?? 0) > 0 ? Math.floor(page as number) : fallback;
}

function normalizePageSize(pageSize: number | undefined, fallback: number, max: number) {
  const normalized = Number.isFinite(pageSize) && (pageSize ?? 0) > 0 ? Math.floor(pageSize as number) : fallback;
  return Math.min(normalized, max);
}

function normalizeOrganization(raw: RawCrmOrganization): CrmOrganization {
  const primaryContact = raw.primary_contact;
  return {
    id: raw.id,
    name: raw.name,
    industry: raw.industry,
    company_size: raw.company_size,
    budget_range: raw.budget_range,
    website_url: raw.website_url,
    address: raw.address,
    taxIdentifierValue: typeof raw.tax_identifier_value === "string" ? raw.tax_identifier_value : null,
    primary_contact_id: raw.primary_contact_id,
    primary_contact: Array.isArray(primaryContact) ? primaryContact[0] ?? null : primaryContact ?? null,
    created_at: raw.created_at,
  };
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
    )
    .order("updated_at", { ascending: false })
    .range(from, to);

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

export async function listCrmOrganizations(
  supabase: SupabaseClient,
  params: CrmOrganizationsListParams = {},
): Promise<CrmOrganizationsListResult> {
  const page = normalizePage(params.page, 1);
  const pageSize = normalizePageSize(params.pageSize, CRM_ORGANIZATIONS_DEFAULT_PAGE_SIZE, CRM_ORGANIZATIONS_MAX_PAGE_SIZE);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = params.search?.trim() ?? "";

  let query = supabase
    .from("organizations")
    .select(
      "id, name, industry, company_size, budget_range, website_url, address, tax_identifier_value, primary_contact_id, created_at, primary_contact:profiles!organizations_primary_contact_id_fkey(id, first_name, last_name, email)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    const safe = search.replace(/[%_,()"]/g, "");
    query = query.ilike("name", `%${safe}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return {
    items: ((data ?? []) as RawCrmOrganization[]).map(normalizeOrganization),
    page,
    pageSize,
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function getCrmContactStatusStats(
  supabase: SupabaseClient,
): Promise<CrmContactStatusStats> {
  const { data, error } = await supabase.from("crm_contacts").select("status");
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{ status?: string | null }>).reduce<CrmContactStatusStats>(
    (acc, row) => {
      const status = typeof row.status === "string" && row.status.trim() ? row.status : "lead";
      acc.total += 1;
      acc.byStatus[status] = (acc.byStatus[status] ?? 0) + 1;
      return acc;
    },
    { total: 0, byStatus: {} },
  );
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
  const { data, error } = await supabase
    .from("crm_status_log")
    .select("id, contact_id, previous_status, new_status, reason, changed_at, changed_by_user_id")
    .gte("changed_at", since)
    .order("changed_at", { ascending: false })
    .limit(limit);

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
