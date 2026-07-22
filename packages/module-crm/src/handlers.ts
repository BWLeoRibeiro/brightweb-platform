import { requireServerUserAccess } from "@brightweblabs/core-auth/server";
import {
  createCrmContactsDeleteHandler,
  createCrmContactsGetHandler,
  createCrmContactsPatchHandler,
  createCrmContactsPostHandler,
  createCrmOrganizationsGetHandler,
  createCrmOwnersGetHandler,
  createCrmReportGetHandler,
  createCrmStatsGetHandler,
  createCrmTimelineGetHandler,
} from "./http";
import {
  getCrmContactStatusStats,
  getCrmReportData,
  listCrmContacts,
  listCrmOrganizations,
  listCrmOwnerOptions,
  listCrmStatusTimeline,
} from "./data";
import {
  bulkSetCrmContactStatus,
  createCrmContact,
  deleteCrmContact,
  updateCrmContact,
} from "./server";

const crmDependencies = {
  getAccess: requireServerUserAccess,
  listContacts: listCrmContacts,
  listOrganizations: listCrmOrganizations,
  getStats: getCrmContactStatusStats,
  listOwners: listCrmOwnerOptions,
  listTimeline: listCrmStatusTimeline,
  getReport: getCrmReportData,
  createContact: createCrmContact,
  updateContact: updateCrmContact,
  setContactStatus: bulkSetCrmContactStatus,
  deleteContact: deleteCrmContact,
};

export const handleCrmContactsGetRequest = createCrmContactsGetHandler(crmDependencies);

export const handleCrmContactsPostRequest = createCrmContactsPostHandler(crmDependencies);

export const handleCrmContactsPatchRequest = createCrmContactsPatchHandler(crmDependencies);

export const handleCrmContactsDeleteRequest = createCrmContactsDeleteHandler(crmDependencies);

export const handleCrmOrganizationsGetRequest = createCrmOrganizationsGetHandler(crmDependencies);

export const handleCrmStatsGetRequest = createCrmStatsGetHandler(crmDependencies);

export const handleCrmOwnersGetRequest = createCrmOwnersGetHandler(crmDependencies);

export const handleCrmTimelineGetRequest = createCrmTimelineGetHandler(crmDependencies);

export const handleCrmReportGetRequest = createCrmReportGetHandler(crmDependencies);
