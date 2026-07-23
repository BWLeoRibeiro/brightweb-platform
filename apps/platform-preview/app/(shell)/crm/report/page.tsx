import { CrmReport } from "@brightweblabs/module-crm/ui";

const data = {
  generatedAt: "2026-07-22T10:30:00.000Z",
  summary: { totalContacts: 18, qualifiedContacts: 10, qualificationRate: 56, wonContacts: 4, lostContacts: 2, closedDeals: 6, winRate: 67, contactsWithOrganization: 15, organizationCoverage: 83 },
  byStatus: [
    { status: "lead", label: "Novo", count: 5, share: 28 },
    { status: "qualified", label: "Qualificado", count: 4, share: 22 },
    { status: "proposal", label: "Proposta", count: 3, share: 17 },
    { status: "won", label: "Ganho", count: 4, share: 22 },
    { status: "lost", label: "Perdido", count: 2, share: 11 },
  ],
  bySource: [{ source: "referência", label: "referência", count: 8, share: 44 }, { source: "website", label: "website", count: 6, share: 33 }, { source: "evento", label: "evento", count: 4, share: 22 }],
  byOwner: [{ ownerId: "owner-leo", label: "Leo Martins", count: 10, share: 56 }, { ownerId: "owner-maya", label: "Maya Costa", count: 8, share: 44 }],
  organizationCoverage: {
    totalOrganizations: 6, organizationsWithContacts: 5, organizationsWithoutContacts: 1, share: 83,
    topOrganizations: [
      { organizationId: "org-analytical", name: "Analytical Engines", industry: "Tecnologia", websiteUrl: "https://example.com", contactCount: 5 },
      { organizationId: "org-orbital", name: "Orbital Research", industry: "Energia", websiteUrl: null, contactCount: 4 },
      { organizationId: "org-lunar", name: "Lunar Systems", industry: "Indústria Transformadora", websiteUrl: null, contactCount: 3 },
    ],
  },
  recentActivity: [],
};

export default function CrmReportPreviewPage() {
  return <CrmReport data={data} />;
}
