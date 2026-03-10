import { redirect } from "next/navigation";
import { createServerSupabase } from "@brightweb/infra/server";

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
  nif: string | null;
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

export type CrmDashboardData = {
  userId: string;
  profileId: string;
  organizations: CrmOrganization[];
  primaryContacts: CrmPrimaryContact[];
  ownerOptions: CrmOwnerOption[];
  contacts: CrmContact[];
  statusLog: CrmStatusLog[];
  stats: { total: number; byStatus: Record<string, number> };
};

function normalizeOrganization<T extends Record<string, unknown>>(raw: T) {
  const primaryContact = raw.primary_contact;
  return {
    ...raw,
    primary_contact: Array.isArray(primaryContact) ? primaryContact[0] ?? null : primaryContact ?? null,
  };
}

function buildProfileDisplayName(profile: {
  first_name: string | null;
  last_name: string | null;
}) {
  const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const combinedFirstLast = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  const safeCombinedFirstLast = combinedFirstLast && !isEmailLike(combinedFirstLast) ? combinedFirstLast : "";
  return safeCombinedFirstLast || null;
}

export async function getCrmDashboardData(): Promise<CrmDashboardData> {
  const supabase = await createServerSupabase();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.id) {
    redirect("/account");
  }

  const [{ data: organizations }, { data: contacts }, { data: statusLog }, { data: primaryContacts }, { data: ownerAssignments }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "id, name, industry, company_size, budget_range, website_url, address, nif, primary_contact_id, created_at, primary_contact:profiles!organizations_primary_contact_id_fkey(id, first_name, last_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("crm_contacts")
      .select(
        "id, first_name, last_name, email, phone, status, source, owner_id, organization_id, created_at, updated_at, organizations(name)",
      )
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("crm_status_log")
      .select("id, contact_id, previous_status, new_status, reason, changed_at, changed_by_user_id")
      .gte("changed_at", sevenDaysAgo.toISOString())
      .order("changed_at", { ascending: false })
      .limit(10),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("user_role_assignments")
      .select("profile_id, role_code, profile:profiles!user_role_assignments_profile_id_fkey(id, first_name, last_name, email)")
      .in("role_code", ["staff", "admin"])
      .order("assigned_at", { ascending: false })
      .limit(500),
  ]);

  const ownerOptions = (ownerAssignments ?? []).reduce<CrmDashboardData["ownerOptions"]>((acc, assignment) => {
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

  const safeContacts = (contacts ?? []).map((contact) => ({
    ...contact,
    organizations: Array.isArray(contact.organizations)
      ? contact.organizations[0] ?? null
      : contact.organizations ?? null,
  }));
  const contactMap = new Map(
    safeContacts.map((contact) => [
      contact.id,
      [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Contacto",
    ]),
  );

  const stats = safeContacts.reduce(
    (acc, contact) => {
      const status = contact.status ?? "lead";
      acc.total += 1;
      acc.byStatus[status] = (acc.byStatus[status] ?? 0) + 1;
      return acc;
    },
    { total: 0, byStatus: {} as Record<string, number> },
  );

  const changedByIds = Array.from(
    new Set((statusLog ?? []).map((entry) => entry.changed_by_user_id).filter((value): value is string => Boolean(value))),
  );

  const changedByMap = new Map<string, string>();
  if (changedByIds.length > 0) {
    const { data: changedByProfiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", changedByIds);

    (changedByProfiles ?? []).forEach((profile) => {
      const userId = profile.user_id;
      const label = buildProfileDisplayName(profile);
      if (userId && label) {
        changedByMap.set(userId, label);
      }
    });
  }

  return {
    userId: user.id,
    profileId: profile.id,
    organizations: (organizations ?? []).map(normalizeOrganization),
    primaryContacts: primaryContacts ?? [],
    ownerOptions,
    contacts: safeContacts,
    statusLog: (statusLog ?? []).map((entry) => ({
      ...entry,
      contact_label: contactMap.get(entry.contact_id) ?? "Contacto",
      changed_by_label: entry.changed_by_user_id ? (changedByMap.get(entry.changed_by_user_id) ?? null) : null,
    })),
    stats,
  };
}
