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

export const CRM_CONTACTS_DEFAULT_PAGE_SIZE = 50;
export const CRM_CONTACTS_MAX_PAGE_SIZE = 100;
export const CRM_ORGANIZATIONS_DEFAULT_PAGE_SIZE = 20;
export const CRM_ORGANIZATIONS_MAX_PAGE_SIZE = 100;

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
