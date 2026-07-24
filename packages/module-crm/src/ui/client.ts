import type { CrmContactsListParams } from "../data";
import type { CrmContactStatus } from "../server";
import { readPublicError } from "@brightweblabs/infra/robustness";
import type { CrmContactFormInput, CrmOrganizationWriteInput, CrmUiClient } from "./types";
import {
  parseCrmContactWriteResponse,
  parseCrmContactsResponse,
  parseCrmDeleteOrStatusResponse,
  parseCrmOrganizationWriteResponse,
  parseCrmOrganizationsResponse,
  parseCrmOwnersResponse,
  parseCrmReportResponse,
  parseCrmStatsResponse,
  parseCrmTimelineResponse,
} from "./response-parsers";

async function readPayload(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readPublicError(payload, response.statusText || "CRM request failed.").message);
  return payload;
}

function contactPayload(input: CrmContactFormInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    source: input.source,
    organizationId: input.organizationId,
    ownerId: input.ownerId,
    status: input.status,
  };
}

function organizationPayload(input: CrmOrganizationWriteInput) {
  return {
    name: input.name,
    industry: input.industry,
    companySize: input.company_size,
    budgetRange: input.budget_range,
    websiteUrl: input.website_url,
    addressLine1: input.address,
    taxIdentifierValue: input.taxIdentifierValue,
    primaryContactId: input.primary_contact_id,
  };
}

export function createCrmUiClient(
  basePath = "/api/crm",
  fetcher: typeof fetch = fetch,
  organizationsBasePath = "/api/organizations",
): CrmUiClient {
  const endpoint = (path: string) => `${basePath.replace(/\/$/, "")}/${path}`;
  const organizationsRoot = organizationsBasePath.replace(/\/$/, "");

  return {
    async listContacts(params: CrmContactsListParams = {}) {
      const query = new URLSearchParams();
      if (params.page) query.set("page", String(params.page));
      if (params.pageSize) query.set("pageSize", String(params.pageSize));
      if (params.search) query.set("search", params.search);
      if (params.status) query.set("status", params.status);
      if (params.organizationId) query.set("organizationId", params.organizationId);
      if (params.ownerProfileId) query.set("ownerProfileId", params.ownerProfileId);
      if (params.sort) query.set("sort", params.sort);
      return parseCrmContactsResponse(await readPayload(await fetcher(`${endpoint("contacts")}?${query.toString()}`)));
    },
    async getStats() {
      return parseCrmStatsResponse(await readPayload(await fetcher(endpoint("stats"))));
    },
    async listOwners() {
      return parseCrmOwnersResponse(await readPayload(await fetcher(endpoint("owners"))));
    },
    async listOrganizations() {
      return parseCrmOrganizationsResponse(
        await readPayload(await fetcher(`${endpoint("organizations")}?pageSize=100`)),
      );
    },
    async createOrganization(input) {
      return parseCrmOrganizationWriteResponse(
        await readPayload(await fetcher(organizationsRoot, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(organizationPayload(input)),
        })),
      );
    },
    async updateOrganization(organizationId, input) {
      return parseCrmOrganizationWriteResponse(
        await readPayload(await fetcher(`${organizationsRoot}/${encodeURIComponent(organizationId)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(organizationPayload(input)),
        })),
      );
    },
    async listTimeline(contactId?: string) {
      const query = new URLSearchParams();
      if (contactId) query.set("contactId", contactId);
      return parseCrmTimelineResponse(
        await readPayload(await fetcher(`${endpoint("timeline")}?${query.toString()}`)),
      );
    },
    async getReport() {
      return parseCrmReportResponse(await readPayload(await fetcher(endpoint("report"))));
    },
    async createContact(input) {
      return parseCrmContactWriteResponse(await readPayload(await fetcher(endpoint("contacts"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contactPayload(input)),
      })));
    },
    async updateContact(contactId, input) {
      return parseCrmContactWriteResponse(await readPayload(await fetcher(endpoint("contacts"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contactId, ...contactPayload(input) }),
      })));
    },
    async setStatus(contactIds: string[], status: CrmContactStatus, reason?: string | null) {
      parseCrmDeleteOrStatusResponse(await readPayload(await fetcher(endpoint("contacts"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contactIds, status, reason }),
      })));
    },
    async deleteContacts(contactIds: string[]) {
      parseCrmDeleteOrStatusResponse(await readPayload(await fetcher(endpoint("contacts"), {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contactIds }),
      })));
    },
  };
}
