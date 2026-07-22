"use client";

import type { CrmContact, CrmContactsListParams, CrmContactsListResult, CrmStatusLog } from "@brightweblabs/module-crm";
import { CrmDashboard, type CrmContactFormInput, type CrmUiClient } from "@brightweblabs/module-crm/ui";

const contacts: CrmContact[] = [
  { id: "contact-ada", first_name: "Ada", last_name: "Lovelace", email: "ada@analytical.example", phone: "+351912345671", status: "lead", source: "Referral", owner_id: "owner-leo", organization_id: "org-analytical", created_at: "2026-07-02T09:00:00.000Z", updated_at: "2026-07-18T14:30:00.000Z", organizations: { name: "Analytical Engines" } },
  { id: "contact-grace", first_name: "Grace", last_name: "Hopper", email: "grace@compiler.example", phone: "+351912345672", status: "qualified", source: "Conference", owner_id: "owner-maya", organization_id: "org-compiler", created_at: "2026-07-03T10:00:00.000Z", updated_at: "2026-07-17T11:45:00.000Z", organizations: { name: "Compiler Works" } },
  { id: "contact-katherine", first_name: "Katherine", last_name: "Johnson", email: "katherine@orbital.example", phone: "+351912345673", status: "proposal", source: "Website", owner_id: "owner-leo", organization_id: "org-orbital", created_at: "2026-07-04T11:00:00.000Z", updated_at: "2026-07-16T16:20:00.000Z", organizations: { name: "Orbital Research" } },
  { id: "contact-margaret", first_name: "Margaret", last_name: "Hamilton", email: "margaret@lunar.example", phone: "+351912345674", status: "won", source: "Partner", owner_id: "owner-maya", organization_id: "org-lunar", created_at: "2026-07-05T12:00:00.000Z", updated_at: "2026-07-15T13:10:00.000Z", organizations: { name: "Lunar Systems" } },
  { id: "contact-radia", first_name: "Radia", last_name: "Perlman", email: "radia@network.example", phone: "+351912345675", status: "lost", source: "Outbound", owner_id: "owner-leo", organization_id: "org-network", created_at: "2026-07-06T13:00:00.000Z", updated_at: "2026-07-14T09:25:00.000Z", organizations: { name: "Network Labs" } },
];

const owners = [
  { id: "owner-leo", label: "Leo Martins", email: "leo@brightweb.example", role: "admin" as const },
  { id: "owner-maya", label: "Maya Costa", email: "maya@brightweb.example", role: "staff" as const },
];

const organizations = [
  { id: "org-analytical", name: "Analytical Engines", industry: "Tecnologia", company_size: "10-50", budget_range: "25.000 € - 50.000 €", website_url: "https://example.com", address: "Lisboa", taxIdentifierValue: "PT500000001" },
  { id: "org-compiler", name: "Compiler Works", industry: "Educação", company_size: "50-100", budget_range: "50.000 € - 100.000 €", website_url: "https://example.com", address: "Porto" },
  { id: "org-orbital", name: "Orbital Research", industry: "Energia", company_size: "100++", budget_range: "100.000 €+", website_url: "https://example.com", address: "Coimbra" },
  { id: "org-lunar", name: "Lunar Systems", industry: "Indústria Transformadora", company_size: "10-50", budget_range: "10.000 € - 25.000 €", website_url: null, address: "Braga" },
  { id: "org-network", name: "Network Labs", industry: "Tecnologia", company_size: "1-10", budget_range: "5.000 € - 10.000 €", website_url: null, address: "Aveiro" },
];

const timeline: CrmStatusLog[] = contacts.map((contact, index) => ({ id: `timeline-${contact.id}`, contact_id: contact.id, previous_status: index === 0 ? null : "lead", new_status: contact.status, reason: index === 4 ? "Sem alinhamento de orçamento" : null, changed_at: contact.updated_at, changed_by_user_id: null, changed_by_label: index % 2 === 0 ? "Leo Martins" : "Maya Costa", contact_label: [contact.first_name, contact.last_name].filter(Boolean).join(" ") }));

function listContacts(params: CrmContactsListParams = {}): CrmContactsListResult {
  const search = params.search?.trim().toLowerCase();
  const filtered = contacts.filter((contact) => {
    const haystack = [contact.first_name, contact.last_name, contact.email, contact.organizations?.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (!search || haystack.includes(search))
      && (!params.status || contact.status === params.status)
      && (!params.organizationId || contact.organization_id === params.organizationId)
      && (!params.ownerProfileId || contact.owner_id === params.ownerProfileId);
  });
  const pageSize = params.pageSize ?? 20;
  const page = params.page ?? 1;

  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  };
}

const mockClient: CrmUiClient = {
  async listContacts(params) { return listContacts(params); },
  async getStats() { return { total: contacts.length, byStatus: { lead: 1, qualified: 1, proposal: 1, won: 1, lost: 1 } }; },
  async listOwners() { return owners; },
  async listOrganizations() { return organizations; },
  async listTimeline(contactId): Promise<CrmStatusLog[]> {
    if (!contactId) return timeline;
    const contact = contacts.find((candidate) => candidate.id === contactId);
    return contact ? timeline.filter((entry) => entry.contact_id === contact.id) : [];
  },
  async getReport() { throw new Error("O relatório de pré-visualização usa dados locais."); },
  async createContact(input: CrmContactFormInput) { return { ...contacts[0], id: "contact-preview", first_name: input.firstName ?? null, last_name: input.lastName ?? null, email: input.email ?? null, phone: input.phone ?? null, status: input.status, source: input.source ?? null, owner_id: input.ownerId ?? null, organization_id: input.organizationId ?? null }; },
  async updateContact(contactId, input) { return { ...contacts.find((contact) => contact.id === contactId) ?? contacts[0], id: contactId, first_name: input.firstName ?? null, last_name: input.lastName ?? null, email: input.email ?? null, phone: input.phone ?? null, status: input.status, source: input.source ?? null, owner_id: input.ownerId ?? null, organization_id: input.organizationId ?? null }; },
  async setStatus() {},
  async deleteContacts() {},
};

const initialData = {
  contacts: listContacts(),
  stats: { total: contacts.length, byStatus: { lead: 1, qualified: 1, proposal: 1, won: 1, lost: 1 } },
  owners,
  organizations,
  timeline,
};

export default function CrmPage() {
  return <CrmDashboard client={mockClient} initialData={initialData} />;
}
