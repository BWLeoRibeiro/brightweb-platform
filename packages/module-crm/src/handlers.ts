import { requireServerUserAccess } from "@brightweblabs/core-auth/server";
import {
  createCrmContactsGetHandler,
  createCrmContactsPatchHandler,
  createCrmContactsPostHandler,
  createCrmOrganizationsGetHandler,
  createCrmOwnersGetHandler,
  createCrmStatsGetHandler,
  createCrmTimelineGetHandler,
} from "./http";
import {
  getCrmContactStatusStats,
  listCrmContacts,
  listCrmOrganizations,
  listCrmOwnerOptions,
  listCrmStatusTimeline,
} from "./data";
import {
  bulkSetCrmContactStatus,
  createCrmContact,
  updateCrmContact,
} from "./server";

const crmDependencies = {
  getAccess: requireServerUserAccess,
  listContacts: listCrmContacts,
  listOrganizations: listCrmOrganizations,
  getStats: getCrmContactStatusStats,
  listOwners: listCrmOwnerOptions,
  listTimeline: listCrmStatusTimeline,
  createContact: createCrmContact,
  updateContact: updateCrmContact,
  setContactStatus: bulkSetCrmContactStatus,
};

export const handleCrmContactsGetRequest = createCrmContactsGetHandler(crmDependencies);

export const handleCrmContactsPostRequest = createCrmContactsPostHandler(crmDependencies);

export const handleCrmContactsPatchRequest = createCrmContactsPatchHandler(crmDependencies);

export const handleCrmOrganizationsGetRequest = createCrmOrganizationsGetHandler(crmDependencies);

export const handleCrmStatsGetRequest = createCrmStatsGetHandler(crmDependencies);

export const handleCrmOwnersGetRequest = createCrmOwnersGetHandler(crmDependencies);

export const handleCrmTimelineGetRequest = createCrmTimelineGetHandler(crmDependencies);
