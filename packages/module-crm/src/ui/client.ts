import type { CrmContactsListParams, CrmOrganizationsListParams } from "../data";
import type { CrmContactStatus } from "../server";
import { readPublicError } from "@brightweblabs/infra/robustness";
import { observedFetch } from "@brightweblabs/infra/request-observability";
import type { CrmContactFormInput, CrmOrganizationWriteInput, CrmUiClient, CrmUiClientOptions } from "./types";
import {
  parseCrmContactWriteResponse,
  parseCrmContactsResponse,
  parseCrmDeleteOrStatusResponse,
  parseCrmOrganizationWriteResponse,
  parseCrmOrganizationsListResponse,
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
    addressLine2: input.addressLine2,
    zipCode: input.zipCode,
    country: input.country,
    taxIdentifierValue: input.taxIdentifierValue,
    primaryContactId: input.primary_contact_id,
    invitations: input.invitations,
  };
}

export function createCrmUiClient(
  basePath = "/api/crm",
  fetcher: typeof fetch = fetch,
  organizationsBasePath = "/api/organizations",
  options: CrmUiClientOptions = {},
): CrmUiClient {
  const endpoint = (path: string) => `${basePath.replace(/\/$/, "")}/${path}`;
  const organizationsRoot = organizationsBasePath.replace(/\/$/, "");

  return {
    async listContacts(params: CrmContactsListParams = {}, requestOptions = {}) {
      const query = new URLSearchParams();
      if (params.page) query.set("page", String(params.page));
      if (params.pageSize) query.set("pageSize", String(params.pageSize));
      if (params.search) query.set("search", params.search);
      if (params.status) query.set("status", params.status);
      if (params.organizationId) query.set("organizationId", params.organizationId);
      if (params.ownerProfileId) query.set("ownerProfileId", params.ownerProfileId);
      if (params.sort) query.set("sort", params.sort);
      return parseCrmContactsResponse(await readPayload(await observedFetch(
        fetcher,
        `${endpoint("contacts")}?${query.toString()}`,
        { signal: requestOptions.signal },
        { domain: "crm", operation: "contacts.list", observer: options.onRequestMetric },
      )));
    },
    async getStats(requestOptions = {}) {
      return parseCrmStatsResponse(await readPayload(await observedFetch(fetcher, endpoint("stats"), { signal: requestOptions.signal }, { domain: "crm", operation: "stats.get", observer: options.onRequestMetric })));
    },
    async listOwners(requestOptions = {}) {
      return parseCrmOwnersResponse(await readPayload(await observedFetch(fetcher, endpoint("owners"), { signal: requestOptions.signal }, { domain: "crm", operation: "owners.list", observer: options.onRequestMetric })));
    },
    async listOrganizations(requestOptions = {}) {
      return parseCrmOrganizationsResponse(
        await readPayload(await observedFetch(fetcher, `${endpoint("organizations")}?pageSize=100`, { signal: requestOptions.signal }, { domain: "crm", operation: "organizations.summary", observer: options.onRequestMetric })),
      );
    },
    async queryOrganizations(params: CrmOrganizationsListParams = {}, requestOptions = {}) {
      const query = new URLSearchParams();
      if (params.page) query.set("page", String(params.page));
      if (params.pageSize) query.set("pageSize", String(params.pageSize));
      if (params.search) query.set("search", params.search);
      return parseCrmOrganizationsListResponse(await readPayload(await observedFetch(
        fetcher,
        `${endpoint("organizations")}?${query.toString()}`,
        { signal: requestOptions.signal },
        { domain: "crm", operation: "organizations.list", observer: options.onRequestMetric },
      )));
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
    async deleteOrganization(organizationId) {
      await readPayload(await fetcher(`${organizationsRoot}/${encodeURIComponent(organizationId)}`, {
        method: "DELETE",
      }));
    },
    async listOrganizationInvitations(organizationId) {
      const payload = await readPayload(await fetcher(
        `${organizationsRoot}/${encodeURIComponent(organizationId)}/invitations`,
      ));
      const data = payload && typeof payload === "object" && "data" in payload
        ? (payload as { data?: unknown }).data
        : null;
      const invitations = data && typeof data === "object" && "invitations" in data
        ? (data as { invitations?: unknown }).invitations
        : [];
      return Array.isArray(invitations) ? invitations.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        if (typeof record.id !== "string" || typeof record.email !== "string") return [];
        return [{ id: record.id, email: record.email, role: record.role === "admin" ? "admin" as const : "member" as const }];
      }) : [];
    },
    async revokeOrganizationInvitation(organizationId, invitationId) {
      await readPayload(await fetcher(
        `${organizationsRoot}/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}`,
        { method: "DELETE" },
      ));
    },
    async listTimeline(contactId?: string, requestOptions = {}) {
      const query = new URLSearchParams();
      if (contactId) query.set("contactId", contactId);
      return parseCrmTimelineResponse(
        await readPayload(await observedFetch(fetcher, `${endpoint("timeline")}?${query.toString()}`, { signal: requestOptions.signal }, { domain: "crm", operation: "timeline.list", observer: options.onRequestMetric })),
      );
    },
    async queryTimeline(params = {}, requestOptions = {}) {
      const query = new URLSearchParams();
      if (params.contactId) query.set("contactId", params.contactId);
      if (params.search) query.set("search", params.search);
      if (params.limit) query.set("limit", String(params.limit));
      return parseCrmTimelineResponse(
        await readPayload(await observedFetch(fetcher, `${endpoint("timeline")}?${query.toString()}`, { signal: requestOptions.signal }, { domain: "crm", operation: "timeline.query", observer: options.onRequestMetric })),
      );
    },
    async getReport(requestOptions = {}) {
      return parseCrmReportResponse(await readPayload(await observedFetch(fetcher, endpoint("report"), { signal: requestOptions.signal }, { domain: "crm", operation: "report.get", observer: options.onRequestMetric })));
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
