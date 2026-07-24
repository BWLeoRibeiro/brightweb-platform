import type { CrmContact, CrmContactsListParams } from "../data";
import type { CrmContactStatus } from "../server";
import type { CrmContactFormInput, CrmOrganizationWriteInput, CrmUiClient } from "./types";

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? response.statusText);
  return payload as T;
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
      return readJson(await fetcher(`${endpoint("contacts")}?${query.toString()}`));
    },
    async getStats() {
      return readJson(await fetcher(endpoint("stats")));
    },
    async listOwners() {
      return readJson(await fetcher(endpoint("owners")));
    },
    async listOrganizations() {
      const result = await readJson<{ items: Array<{ id: string; name: string | null }> }>(
        await fetcher(`${endpoint("organizations")}?pageSize=100`),
      );
      return result.items;
    },
    async createOrganization(input) {
      const result = await readJson<{ data: { organization: Awaited<ReturnType<CrmUiClient["createOrganization"]>> } }>(
        await fetcher(organizationsRoot, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(organizationPayload(input)),
        }),
      );
      return result.data.organization;
    },
    async updateOrganization(organizationId, input) {
      const result = await readJson<{ data: { organization: Awaited<ReturnType<CrmUiClient["updateOrganization"]>> } }>(
        await fetcher(`${organizationsRoot}/${encodeURIComponent(organizationId)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(organizationPayload(input)),
        }),
      );
      return result.data.organization;
    },
    async listTimeline(contactId?: string) {
      const query = new URLSearchParams();
      if (contactId) query.set("contactId", contactId);
      return readJson(await fetcher(`${endpoint("timeline")}?${query.toString()}`));
    },
    async getReport() {
      return readJson(await fetcher(endpoint("report")));
    },
    async createContact(input) {
      const result = await readJson<{ data: { contact: CrmContact } }>(await fetcher(endpoint("contacts"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contactPayload(input)),
      }));
      return result.data.contact;
    },
    async updateContact(contactId, input) {
      const result = await readJson<{ data: { contact: CrmContact } }>(await fetcher(endpoint("contacts"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contactId, ...contactPayload(input) }),
      }));
      return result.data.contact;
    },
    async setStatus(contactIds: string[], status: CrmContactStatus, reason?: string | null) {
      await readJson(await fetcher(endpoint("contacts"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contactIds, status, reason }),
      }));
    },
    async deleteContacts(contactIds: string[]) {
      await readJson(await fetcher(endpoint("contacts"), {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contactIds }),
      }));
    },
  };
}
