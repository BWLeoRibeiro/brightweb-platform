import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import {
  listOrganizations,
  type Organization,
} from "@brightweblabs/module-orgs";
/** @deprecated Import listOrganizations from @brightweblabs/module-orgs. */
export { listOrganizations as listCrmOrganizations } from "@brightweblabs/module-orgs";
/** @deprecated Import organization types and constants from @brightweblabs/module-orgs. */
export {
  ORGANIZATIONS_DEFAULT_PAGE_SIZE as CRM_ORGANIZATIONS_DEFAULT_PAGE_SIZE,
  ORGANIZATIONS_MAX_PAGE_SIZE as CRM_ORGANIZATIONS_MAX_PAGE_SIZE,
  type Organization as CrmOrganization,
  type OrganizationsListParams as CrmOrganizationsListParams,
  type OrganizationsListResult as CrmOrganizationsListResult,
} from "@brightweblabs/module-orgs";
export {
  composeCrmMessage,
  ptCrmActivityDictionary,
  type CrmActivityDictionary,
  type CrmActivityMessageItem,
} from "./activity-messages";
export {
  CRM_CONTACTS_DEFAULT_PAGE_SIZE,
  CRM_CONTACTS_MAX_PAGE_SIZE,
  CRM_PRIMARY_CONTACTS_DEFAULT_LIMIT,
  CRM_STATUS_TIMELINE_DEFAULT_DAYS,
  CRM_STATUS_TIMELINE_DEFAULT_LIMIT,
  getCrmContactStatusStats,
  listCrmContacts,
  listCrmOwnerOptions,
  listCrmPrimaryContacts,
  listCrmStatusTimeline,
  type CrmContact,
  type CrmContactStatusStats,
  type CrmContactsListParams,
  type CrmContactsListResult,
  type CrmOwnerOption,
  type CrmPrimaryContact,
  type CrmPrimaryContactsData,
  type CrmPrimaryContactsListParams,
  type CrmStatusLog,
  type CrmStatusTimelineData,
  type CrmStatusTimelineParams,
} from "./data";
export {
  handleCrmContactsGetRequest,
  handleCrmOrganizationsGetRequest,
  handleCrmOwnersGetRequest,
  handleCrmStatsGetRequest,
} from "./handlers";
import {
  getCrmContactStatusStats,
  listCrmContacts,
  listCrmOwnerOptions,
  listCrmPrimaryContacts,
  listCrmStatusTimeline,
  type CrmContact,
  type CrmContactStatusStats,
  type CrmOwnerOption,
  type CrmPrimaryContact,
  type CrmStatusLog,
} from "./data";

export type CrmDashboardData = {
  userId: string;
  profileId: string;
  organizations: Organization[];
  primaryContacts: CrmPrimaryContact[];
  ownerOptions: CrmOwnerOption[];
  contacts: CrmContact[];
  statusLog: CrmStatusLog[];
  stats: CrmContactStatusStats;
};

export async function getCrmDashboardData(): Promise<CrmDashboardData> {
  const { supabase, user, profileId } = await requireServerPageAccess();

  const [
    { items: organizations },
    { items: contacts },
    stats,
    ownerOptions,
    statusLog,
    primaryContacts,
  ] = await Promise.all([
    listOrganizations(supabase, { page: 1, pageSize: 12 }),
    listCrmContacts(supabase, { page: 1, pageSize: 100 }),
    getCrmContactStatusStats(supabase),
    listCrmOwnerOptions(supabase),
    listCrmStatusTimeline(supabase),
    listCrmPrimaryContacts(supabase),
  ]);

  return {
    userId: user.id,
    profileId,
    organizations,
    primaryContacts,
    ownerOptions,
    contacts,
    statusLog,
    stats,
  };
}
