import type { SupabaseClient } from "@supabase/supabase-js";

export type OrganizationPrimaryContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type Organization = {
  id: string;
  name: string;
  industry: string | null;
  company_size: string | null;
  budget_range: string | null;
  website_url: string | null;
  address: string | null;
  taxIdentifierValue: string | null;
  primary_contact_id: string | null;
  primary_contact?: OrganizationPrimaryContact | null;
  created_at: string;
};

export type OrganizationsListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
};

export type OrganizationsListResult = {
  items: Organization[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CreateOrganizationInput = {
  name: string;
  industry?: string | null;
  companySize?: string | null;
  budgetRange?: string | null;
  websiteUrl?: string | null;
  address?: string | null;
  taxIdentifierValue?: string | null;
  primaryContactId?: string | null;
};

export type UpdateOrganizationInput = CreateOrganizationInput;

export type OrganizationMemberRole = "admin" | "member";

export type OrganizationMember = {
  id: string;
  organization_id: string;
  profile_id: string;
  role: OrganizationMemberRole;
  joined_at: string;
};

type RawOrganization = {
  id: string;
  name: string;
  industry: string | null;
  company_size: string | null;
  budget_range: string | null;
  website_url: string | null;
  address: string | null;
  tax_identifier_value?: string | null;
  primary_contact_id: string | null;
  primary_contact?: OrganizationPrimaryContact | OrganizationPrimaryContact[] | null;
  created_at: string;
};

export const ORGANIZATIONS_DEFAULT_PAGE_SIZE = 20;
export const ORGANIZATIONS_MAX_PAGE_SIZE = 100;

function normalizePage(page: number | undefined, fallback: number) {
  return Number.isFinite(page) && (page ?? 0) > 0 ? Math.floor(page as number) : fallback;
}

function normalizePageSize(pageSize: number | undefined, fallback: number, max: number) {
  const normalized = Number.isFinite(pageSize) && (pageSize ?? 0) > 0 ? Math.floor(pageSize as number) : fallback;
  return Math.min(normalized, max);
}

function normalizeOrganization(raw: RawOrganization): Organization {
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

export async function listOrganizations(
  supabase: SupabaseClient,
  params: OrganizationsListParams = {},
): Promise<OrganizationsListResult> {
  const page = normalizePage(params.page, 1);
  const pageSize = normalizePageSize(params.pageSize, ORGANIZATIONS_DEFAULT_PAGE_SIZE, ORGANIZATIONS_MAX_PAGE_SIZE);
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
    const safe = search.replace(/[%_,()\"]/g, "");
    query = query.ilike("name", `%${safe}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    items: ((data ?? []) as RawOrganization[]).map(normalizeOrganization),
    page,
    pageSize,
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function createOrganization(
  supabase: SupabaseClient,
  input: CreateOrganizationInput,
): Promise<Organization> {
  const name = input.name.trim();
  if (!name) throw new Error("Organization name is required.");

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name,
      industry: input.industry?.trim() || null,
      company_size: input.companySize?.trim() || null,
      budget_range: input.budgetRange?.trim() || null,
      website_url: input.websiteUrl?.trim() || null,
      address: input.address?.trim() || null,
      tax_identifier_value: input.taxIdentifierValue?.trim() || null,
      primary_contact_id: input.primaryContactId || null,
    })
    .select(
      "id, name, industry, company_size, budget_range, website_url, address, tax_identifier_value, primary_contact_id, created_at, primary_contact:profiles!organizations_primary_contact_id_fkey(id, first_name, last_name, email)",
    )
    .single();

  if (error) throw new Error(error.message);
  return normalizeOrganization(data as RawOrganization);
}

export async function updateOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  input: UpdateOrganizationInput,
): Promise<Organization> {
  const name = input.name.trim();
  if (!name) throw new Error("Organization name is required.");

  const { data, error } = await supabase
    .from("organizations")
    .update({
      name,
      industry: input.industry?.trim() || null,
      company_size: input.companySize?.trim() || null,
      budget_range: input.budgetRange?.trim() || null,
      website_url: input.websiteUrl?.trim() || null,
      address: input.address?.trim() || null,
      tax_identifier_value: input.taxIdentifierValue?.trim() || null,
      primary_contact_id: input.primaryContactId || null,
    })
    .eq("id", organizationId)
    .select(
      "id, name, industry, company_size, budget_range, website_url, address, tax_identifier_value, primary_contact_id, created_at, primary_contact:profiles!organizations_primary_contact_id_fkey(id, first_name, last_name, email)",
    )
    .single();

  if (error) throw new Error(error.message);
  return normalizeOrganization(data as RawOrganization);
}

export async function listOrganizationMembers(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationMember[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, organization_id, profile_id, role, joined_at")
    .eq("organization_id", organizationId)
    .order("joined_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).filter(
    (member): member is OrganizationMember => member.role === "admin" || member.role === "member",
  );
}

export async function setOrganizationMemberRole(
  supabase: SupabaseClient,
  organizationId: string,
  profileId: string,
  role: OrganizationMemberRole,
): Promise<OrganizationMember> {
  const { data, error } = await supabase
    .from("organization_members")
    .upsert(
      {
        organization_id: organizationId,
        profile_id: profileId,
        role,
      },
      { onConflict: "organization_id,profile_id" },
    )
    .select("id, organization_id, profile_id, role, joined_at")
    .single();

  if (error) throw new Error(error.message);
  if (data.role !== "admin" && data.role !== "member") throw new Error("Invalid organization member role.");
  return data as OrganizationMember;
}
