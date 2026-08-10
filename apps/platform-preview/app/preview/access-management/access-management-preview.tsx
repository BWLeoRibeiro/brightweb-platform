"use client";

import { useState } from "react";
import { AdminUsersClient, type AdminUiClient, type AdminUserInvitation } from "@brightweblabs/module-admin/ui";
import { CrmOrganizationsPage, type CrmOrganization, type CrmOrganizationAccess, type CrmUiClient } from "@brightweblabs/module-crm/ui";
import { Button } from "@brightweblabs/ui";
import { PreviewShellLayoutClient } from "../../(shell)/shell-layout-client";

let organization: CrmOrganization = {
  id: "verde-atlantico",
  name: "Verde Atlântico",
  industry: "Agricultura",
  company_size: "10-50",
  budget_range: "25.000 € - 50.000 €",
  website_url: "https://verdeatlantico.pt",
  address: "Lisboa, Portugal",
  taxIdentifierValue: "501234567",
  primary_contact_id: "marta-profile",
  created_at: "2026-05-12T09:00:00.000Z",
};

let invitations: AdminUserInvitation[] = [
  { id: "org-invite-rui", email: "rui@verde.pt", role: "client", status: "pending", createdAt: "2026-08-06T09:00:00.000Z", expiresAt: "2026-08-20T09:00:00.000Z", source: "organization", organizationId: organization.id, organizationName: organization.name, organizationRole: "member" },
  { id: "org-invite-sofia", email: "sofia@solar.pt", role: "client", status: "accepted", createdAt: "2026-08-02T10:00:00.000Z", expiresAt: "2026-08-16T10:00:00.000Z", source: "organization", organizationId: "solar-norte", organizationName: "Solar Norte", organizationRole: "admin" },
  { id: "global-invite-ines", email: "ines@brightweb.pt", role: "staff", status: "pending", createdAt: "2026-08-08T10:00:00.000Z", expiresAt: "2026-08-22T10:00:00.000Z", source: "global" },
];

let organizationAccess: CrmOrganizationAccess = {
  members: [
    { id: "member-marta", profileId: "marta-profile", role: "admin", joinedAt: "2026-05-12T09:00:00.000Z", label: "Marta Costa", email: "marta@verde.pt" },
    { id: "member-ana", profileId: "ana-profile", role: "member", joinedAt: "2026-06-02T09:00:00.000Z", label: "Ana Martins", email: "ana@cliente.pt" },
  ],
  invitations: [{ id: "org-invite-rui", organizationId: organization.id, email: "rui@verde.pt", role: "member", status: "pending", createdAt: "2026-08-06T09:00:00.000Z", expiresAt: "2026-08-20T09:00:00.000Z" }],
};

const adminClient: AdminUiClient = {
  async listUsers() { return { data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } }; },
  async listInvitations() { return invitations; },
  async listOrganizations() { return [{ id: organization.id, name: organization.name ?? organization.id }, { id: "solar-norte", name: "Solar Norte" }]; },
  async inviteUser(input) {
    const created: AdminUserInvitation = { id: `invite-${Date.now()}`, email: input.email, role: input.role, status: "pending", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(), source: input.role === "client" ? "organization" : "global", organizationId: input.organizationId, organizationName: input.organizationName, organizationRole: input.organizationRole };
    invitations = [created, ...invitations];
    return created;
  },
  async revokeInvitation(invitation) { invitations = invitations.map((item) => item.id === invitation.id ? { ...item, status: "revoked" } : item); },
  async changeRoles() { return { changed: 1, skipped: 0 }; },
};

const crmClient = {
  async getOrganization() { return organization; },
  async listOrganizations() { return [organization, { id: "solar-norte", name: "Solar Norte", industry: "Energia", company_size: "10-50", budget_range: "50.000 € - 100.000 €", website_url: "https://solarnorte.pt", address: "Braga, Portugal" }, { id: "horta-viva", name: "Horta Viva", industry: "Alimentação e Bebidas", company_size: "1-10", budget_range: "Até 5.000 €", website_url: "https://hortaviva.pt", address: "Setúbal, Portugal" }]; },
  async updateOrganization(_organizationId: string, input: Omit<CrmOrganization, "id" | "created_at">) { organization = { ...organization, ...input }; return organization; },
  async listContacts() { return { items: [
    { id: "contact-marta", first_name: "Marta", last_name: "Costa", email: "marta@verde.pt", phone: null, status: "qualified", source: "referral", owner_id: null, organization_id: organization.id, created_at: "2026-05-12T09:00:00.000Z", updated_at: "2026-08-02T09:00:00.000Z" },
    { id: "contact-rui", first_name: "Rui", last_name: "Lopes", email: "rui@verde.pt", phone: null, status: "lead", source: "website", owner_id: null, organization_id: organization.id, created_at: "2026-06-12T09:00:00.000Z", updated_at: "2026-08-01T09:00:00.000Z" },
    { id: "contact-teresa", first_name: "Teresa", last_name: "Sousa", email: "teresa@verde.pt", phone: null, status: "proposal", source: "event", owner_id: null, organization_id: organization.id, created_at: "2026-07-12T09:00:00.000Z", updated_at: "2026-08-03T09:00:00.000Z" },
  ], page: 1, pageSize: 100, total: 3, totalPages: 1 }; },
  async getOrganizationAccess() { return structuredClone(organizationAccess); },
  async inviteOrganizationMember(_organizationId: string, input: { email: string; role: "admin" | "member" }) { organizationAccess = { ...organizationAccess, invitations: [{ id: `invite-${Date.now()}`, organizationId: organization.id, email: input.email, role: input.role, status: "pending", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString() }, ...organizationAccess.invitations] }; },
  async updateOrganizationMemberRole(_organizationId: string, profileId: string, role: "admin" | "member") { organizationAccess = { ...organizationAccess, members: organizationAccess.members.map((member) => member.profileId === profileId ? { ...member, role } : member) }; },
  async removeOrganizationMember(_organizationId: string, profileId: string) { organizationAccess = { ...organizationAccess, members: organizationAccess.members.filter((member) => member.profileId !== profileId) }; },
  async revokeOrganizationInvitation(_organizationId: string, invitationId: string) { organizationAccess = { ...organizationAccess, invitations: organizationAccess.invitations.map((item) => item.id === invitationId ? { ...item, status: "revoked" } : item) }; },
} as unknown as CrmUiClient;

const initialUsers = {
  data: [
    { profileId: "marta-profile", name: "Marta Costa", email: "marta@verde.pt", role: "client" as const, createdAt: "2026-05-12T09:00:00.000Z", updatedAt: "2026-08-02T09:00:00.000Z" },
    { profileId: "joao-profile", name: "João Silva", email: "joao@brightweb.pt", role: "staff" as const, createdAt: "2026-04-12T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z" },
    { profileId: "leonardo-profile", name: "Leonardo Ribeiro", email: "leonardo@brightweb.pt", role: "admin" as const, createdAt: "2026-01-12T09:00:00.000Z", updatedAt: "2026-08-08T09:00:00.000Z" },
  ],
  pagination: { page: 1, pageSize: 10, total: 3, totalPages: 1 },
};

export function AccessManagementPreview({ initialSurface = "admin", inShell = false }: { initialSurface?: "admin" | "organization"; inShell?: boolean }) {
  const [surface, setSurface] = useState<"admin" | "organization">(initialSurface);
  const content = surface === "admin" ? <AdminUsersClient initialUsers={initialUsers} client={adminClient} /> : <CrmOrganizationsPage client={crmClient} />;

  if (inShell) {
    return <PreviewShellLayoutClient pathnameOverride={surface === "admin" ? "/admin/users" : "/crm/organizations"} viewer={{ profileId: "visual-qa-admin", email: "dev@brightweblabs.test", firstName: "Dev", lastName: "Admin", isAdmin: true, isStaff: true }}>{content}</PreviewShellLayoutClient>;
  }

  return <main className="min-h-screen bg-[color:var(--background)]"><div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-[color:var(--hairline)] bg-[color:var(--background)]/95 px-5 py-3 backdrop-blur"><div><p className="text-label text-[color:var(--accent)]">BrightWeb Platform · Visual QA</p><p className="text-body font-semibold">Gestão de acessos</p></div><div className="flex gap-2"><Button type="button" variant={surface === "admin" ? "brand" : "outline"} onClick={() => setSurface("admin")}>Painel de administração</Button><Button type="button" variant={surface === "organization" ? "brand" : "outline"} onClick={() => setSurface("organization")}>CRM · Organizações</Button></div></div><div className="p-5 md:p-8">{content}</div></main>;
}
