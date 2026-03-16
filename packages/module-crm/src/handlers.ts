import { requireServerUserAccess } from "@brightweblabs/core-auth/server";
import {
  createCrmContactsGetHandler,
  createCrmOrganizationsGetHandler,
  createCrmOwnersGetHandler,
  createCrmStatsGetHandler,
} from "./http.ts";
import {
  getCrmContactStatusStats,
  listCrmContacts,
  listCrmOrganizations,
  listCrmOwnerOptions,
} from "./data.ts";

export const handleCrmContactsGetRequest = createCrmContactsGetHandler({
  getAccess: requireServerUserAccess,
  listContacts: listCrmContacts,
  listOrganizations: listCrmOrganizations,
  getStats: getCrmContactStatusStats,
  listOwners: listCrmOwnerOptions,
});

export const handleCrmOrganizationsGetRequest = createCrmOrganizationsGetHandler({
  getAccess: requireServerUserAccess,
  listContacts: listCrmContacts,
  listOrganizations: listCrmOrganizations,
  getStats: getCrmContactStatusStats,
  listOwners: listCrmOwnerOptions,
});

export const handleCrmStatsGetRequest = createCrmStatsGetHandler({
  getAccess: requireServerUserAccess,
  listContacts: listCrmContacts,
  listOrganizations: listCrmOrganizations,
  getStats: getCrmContactStatusStats,
  listOwners: listCrmOwnerOptions,
});

export const handleCrmOwnersGetRequest = createCrmOwnersGetHandler({
  getAccess: requireServerUserAccess,
  listContacts: listCrmContacts,
  listOrganizations: listCrmOrganizations,
  getStats: getCrmContactStatusStats,
  listOwners: listCrmOwnerOptions,
});
