import { CrmDashboard } from "@brightweblabs/module-crm/ui";

const contacts = [
  {
    id: "preview-contact-1", first_name: "Ada", last_name: "Lovelace", email: "ada@example.com",
    phone: "+351912345678", status: "qualified", source: "Referral", owner_id: "preview-owner-1",
    organization_id: "preview-org-1", created_at: "2026-07-01T09:00:00.000Z", updated_at: "2026-07-18T14:30:00.000Z",
    organizations: { name: "Analytical Engines" },
  },
  {
    id: "preview-contact-2", first_name: "Grace", last_name: "Hopper", email: "grace@example.com",
    phone: "+351923456789", status: "proposal", source: "Website", owner_id: "preview-owner-1",
    organization_id: "preview-org-2", created_at: "2026-07-03T10:00:00.000Z", updated_at: "2026-07-19T11:15:00.000Z",
    organizations: { name: "Compiler Co." },
  },
];

export default function CrmPlaygroundPage() {
  return (
    <CrmDashboard initialData={{
      contacts: { items: contacts, page: 1, pageSize: 20, total: contacts.length, totalPages: 1 },
      stats: { total: contacts.length, byStatus: { lead: 0, qualified: 1, proposal: 1, won: 0, lost: 0 } },
      owners: [{ id: "preview-owner-1", label: "Jamie Rivera", email: "jamie@example.com", role: "staff" }],
      organizations: [{ id: "preview-org-1", name: "Analytical Engines" }, { id: "preview-org-2", name: "Compiler Co." }],
    }} />
  );
}
