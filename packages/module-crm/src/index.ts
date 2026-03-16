import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
export {
  CRM_CONTACTS_DEFAULT_PAGE_SIZE,
  CRM_CONTACTS_MAX_PAGE_SIZE,
  CRM_ORGANIZATIONS_DEFAULT_PAGE_SIZE,
  CRM_ORGANIZATIONS_MAX_PAGE_SIZE,
  getCrmContactStatusStats,
  listCrmContacts,
  listCrmOrganizations,
  listCrmOwnerOptions,
  type CrmContact,
  type CrmContactStatusStats,
  type CrmContactsListParams,
  type CrmContactsListResult,
  type CrmOrganization,
  type CrmOrganizationsListParams,
  type CrmOrganizationsListResult,
  type CrmOwnerOption,
  type CrmPrimaryContact,
  type CrmStatusLog,
} from "./data.ts";
export {
  handleCrmContactsGetRequest,
  handleCrmOrganizationsGetRequest,
  handleCrmOwnersGetRequest,
  handleCrmStatsGetRequest,
} from "./handlers.ts";
import {
  getCrmContactStatusStats,
  listCrmContacts,
  listCrmOrganizations,
  listCrmOwnerOptions,
  type CrmContact,
  type CrmContactStatusStats,
  type CrmOrganization,
  type CrmOwnerOption,
  type CrmPrimaryContact,
  type CrmStatusLog,
} from "./data.ts";

export type CrmDashboardData = {
  userId: string;
  profileId: string;
  organizations: CrmOrganization[];
  primaryContacts: CrmPrimaryContact[];
  ownerOptions: CrmOwnerOption[];
  contacts: CrmContact[];
  statusLog: CrmStatusLog[];
  stats: CrmContactStatusStats;
};

type CrmChangedByProfile = {
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

function buildProfileDisplayName(profile: {
  first_name?: string | null;
  last_name?: string | null;
}) {
  const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const combinedFirstLast = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  const safeCombinedFirstLast = combinedFirstLast && !isEmailLike(combinedFirstLast) ? combinedFirstLast : "";
  return safeCombinedFirstLast || null;
}

export async function getCrmDashboardData(): Promise<CrmDashboardData> {
  const { supabase, user, profileId } = await requireServerPageAccess();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [{ items: organizations }, { items: contacts }, stats, ownerOptions, { data: statusLog }, { data: primaryContacts }] = await Promise.all([
    listCrmOrganizations(supabase, { page: 1, pageSize: 12 }),
    listCrmContacts(supabase, { page: 1, pageSize: 100 }),
    getCrmContactStatusStats(supabase),
    listCrmOwnerOptions(supabase),
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
  ]);
  const contactMap = new Map(
    contacts.map((contact) => [
      contact.id,
      [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Contacto",
    ]),
  );

  const changedByIds = Array.from(
    new Set(((statusLog ?? []) as CrmStatusLog[]).map((entry) => entry.changed_by_user_id).filter((value): value is string => Boolean(value))),
  );

  const changedByMap = new Map<string, string>();
  if (changedByIds.length > 0) {
    const { data: changedByProfiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", changedByIds);

    ((changedByProfiles ?? []) as CrmChangedByProfile[]).forEach((profile) => {
      const userId = profile.user_id;
      const label = buildProfileDisplayName(profile);
      if (userId && label) {
        changedByMap.set(userId, label);
      }
    });
  }

  return {
    userId: user.id,
    profileId,
    organizations,
    primaryContacts: (primaryContacts ?? []) as CrmPrimaryContact[],
    ownerOptions,
    contacts,
    statusLog: ((statusLog ?? []) as CrmStatusLog[]).map((entry) => ({
      ...entry,
      contact_label: contactMap.get(entry.contact_id) ?? "Contacto",
      changed_by_label: entry.changed_by_user_id ? (changedByMap.get(entry.changed_by_user_id) ?? null) : null,
    })),
    stats,
  };
}
