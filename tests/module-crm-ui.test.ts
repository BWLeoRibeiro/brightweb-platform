import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { CrmContact, CrmContactsListResult, CrmStatusLog } from "../packages/module-crm/src/data.ts";
import { crmModuleRegistration } from "../packages/module-crm/src/registration.ts";
import {
  CrmContactDialog,
  CrmContactsTable,
  CrmDashboard,
  CrmDeleteDialog,
  CrmFunnelStats,
  CrmOrganizationsBrowser,
  CrmReport,
  CrmReportPage,
  CrmStatusDialog,
  CrmTimeline,
  CrmTimelineBrowser,
  CrmToolbarCreateMenu,
  CrmToolbarFiltersPill,
  CrmToolbarSearchChip,
  CRM_UI_EVENTS,
  defaultCrmUiDictionary,
  useCrmBulkActions,
  useCrmContactActions,
  useCrmDashboardController,
  useCrmDataSync,
  useCrmDerivedState,
  useCrmMutations,
  useCrmOrganizationActions,
  useCrmWindowEvents,
  type CrmUiDictionary,
} from "../packages/module-crm/src/ui/index.ts";

const contact: CrmContact = {
  id: "contact-1", first_name: "Ada", last_name: "Lovelace", email: "ada@example.com", phone: "+351912345678",
  status: "lead", source: "referral", owner_id: "owner-1", organization_id: "org-1",
  created_at: "2026-07-01T09:00:00.000Z", updated_at: "2026-07-18T14:30:00.000Z", organizations: { name: "Analytical Engines" },
};
const contacts: CrmContactsListResult = { items: [contact], page: 1, pageSize: 20, total: 1, totalPages: 1 };
const timeline: CrmStatusLog[] = [{
  id: "log-1", contact_id: contact.id, previous_status: null, new_status: "lead", reason: "New enquiry",
  changed_at: "2026-07-18T14:30:00.000Z", changed_by_user_id: null, changed_by_label: null, contact_label: "Ada Lovelace",
}];
const report = {
  generatedAt: "2026-07-22T10:30:00.000Z",
  summary: { totalContacts: 1, qualifiedContacts: 0, qualificationRate: 0, wonContacts: 0, lostContacts: 0, closedDeals: 0, winRate: 0, contactsWithOrganization: 1, organizationCoverage: 100 },
  byStatus: [{ status: "lead", label: "Novo", count: 1, share: 100 }],
  bySource: [{ source: "referência", label: "referência", count: 1, share: 100 }],
  byOwner: [{ ownerId: null, label: "Sem responsável", count: 1, share: 100 }],
  organizationCoverage: { totalOrganizations: 1, organizationsWithContacts: 1, organizationsWithoutContacts: 0, share: 100, topOrganizations: [{ organizationId: "org-1", name: "Analytical Engines", industry: "Tecnologia", websiteUrl: null, contactCount: 1 }] },
  recentActivity: [],
};

test("CRM UI surfaces render from data without network access", () => {
  assert.match(renderToStaticMarkup(h(CrmFunnelStats, { stats: { total: 1, byStatus: { lead: 1 } } })), /Novo/);
  assert.match(renderToStaticMarkup(h(CrmContactsTable, { data: contacts })), /Ada Lovelace/);
  assert.match(renderToStaticMarkup(h(CrmTimeline, { entries: timeline })), /New enquiry/);
  assert.doesNotThrow(() => renderToStaticMarkup(h(CrmContactDialog, { open: false, onOpenChange: () => {}, onSubmit: () => {} })));
  assert.doesNotThrow(() => renderToStaticMarkup(h(CrmStatusDialog, { open: false, contactIds: [contact.id], onOpenChange: () => {}, onSubmit: () => {} })));
  assert.doesNotThrow(() => renderToStaticMarkup(h(CrmDeleteDialog, { open: false, contactIds: [contact.id], onOpenChange: () => {}, onConfirm: () => {} })));
  assert.doesNotThrow(() => renderToStaticMarkup(h(CrmOrganizationsBrowser, { open: false, organizations: [], onOpenChange: () => {} })));
  assert.doesNotThrow(() => renderToStaticMarkup(h(CrmTimelineBrowser, { open: false, entries: timeline, onOpenChange: () => {} })));
  assert.match(renderToStaticMarkup(h(CrmReport, { data: report })), /Pulso do/);
  assert.match(renderToStaticMarkup(h(CrmReportPage, { initialData: report })), /Distribuição por estado/);
  assert.match(renderToStaticMarkup(h(CrmDashboard, { initialData: { contacts, stats: { total: 1, byStatus: { lead: 1 } }, owners: [], organizations: [], timeline } })), /Ada Lovelace/);
});

test("CRM dashboard follows the MQ table, right rail, and report hero composition", () => {
  const html = renderToStaticMarkup(h(CrmDashboard, { initialData: { contacts, stats: { total: 1, byStatus: { lead: 1 } }, owners: [], organizations: [{ id: "org-1", name: "Analytical Engines" }], timeline } }));
  assert.match(html, /Timeline/);
  assert.match(html, /Organizações/);
  assert.match(html, /Relatório do CRM/);
  assert.doesNotMatch(html, /Visão geral do funil/);
  assert.ok(html.indexOf("Ada Lovelace") < html.indexOf("Relatório do CRM"));
});

test("CRM shell toolbar controls are exported as independent surfaces", () => {
  assert.match(renderToStaticMarkup(h(CrmToolbarSearchChip, { value: "", onChange: () => {} })), /Pesquisar contactos/);
  assert.match(renderToStaticMarkup(h(CrmToolbarFiltersPill, { status: null, sort: "date_desc", onApply: () => {} })), /Filtros/);
  assert.match(renderToStaticMarkup(h(CrmToolbarCreateMenu)), /Criar/);
  assert.deepEqual(crmModuleRegistration.toolbarActions?.crm?.map((item) => item.action), ["crm-search", "crm-filters", "crm-create-menu"]);
});

test("CRM UI dictionary overrides every rendered label source", () => {
  const dictionary: CrmUiDictionary = {
    ...defaultCrmUiDictionary,
    table: { ...defaultCrmUiDictionary.table, searchPlaceholder: "Encontrar pessoas", columns: { ...defaultCrmUiDictionary.table.columns, name: "Pessoa" } },
  };
  const html = renderToStaticMarkup(h(CrmContactsTable, { data: contacts, dictionary }));
  assert.match(html, /Encontrar pessoas/);
  assert.match(html, /Pessoa/);
});

test("CRM table nests contact details under the name and uses MQ's short updated date", () => {
  const html = renderToStaticMarkup(h(CrmContactsTable, { data: contacts }));
  assert.match(html, /Ada Lovelace.*ada@example\.com/s);
  assert.match(html, /18\/07/);
  assert.doesNotMatch(html, />Email</);
});

test("CRM column config can hide and relabel built-in columns", () => {
  const html = renderToStaticMarkup(h(CrmContactsTable, { data: contacts, columns: [{ key: "name", label: "Contacto" }, { key: "owner", hidden: true }] }));
  assert.match(html, /Contacto/);
  assert.match(html, /ada@example\.com/);
  assert.doesNotMatch(html, />Responsável</);
});

test("CRM stage config controls order, labels, and token metadata", () => {
  const html = renderToStaticMarkup(h(CrmFunnelStats, { stats: { total: 1, byStatus: { lead: 1 } }, stages: [{ value: "lead", label: "Entrada", token: "--crm-stage-lead" }] }));
  assert.match(html, /Entrada/);
  assert.match(html, /var\(--crm-stage-lead-strong\)/);
  assert.doesNotMatch(html, /Qualificado/);
});

test("CRM dashboard renders composition slots and row action render props", () => {
  const html = renderToStaticMarkup(h(CrmDashboard, {
    initialData: { contacts, stats: { total: 1, byStatus: { lead: 1 } }, owners: [], organizations: [] },
    slots: {
      aboveTable: h("p", null, "Área acima da tabela"),
      besideStats: h("p", null, "Área de indicadores"),
      rowActions: (item) => h("button", null, `Abrir ${item.first_name}`),
    },
  }));
  assert.match(html, /Área acima da tabela/);
  assert.match(html, /Área de indicadores/);
  assert.match(html, /Abrir Ada/);
});

test("CRM report slots are composable", () => {
  const html = renderToStaticMarkup(h(CrmReport, { data: report, slots: { afterHero: h("p", null, "Depois do destaque"), beforeDistributions: h("p", null, "Antes das distribuições"), afterDistributions: h("p", null, "Depois das distribuições") } }));
  assert.match(html, /Depois do destaque/);
  assert.match(html, /Antes das distribuições/);
  assert.match(html, /Depois das distribuições/);
});

test("CRM default dictionary is Portuguese and covers a substantial full-page contract", () => {
  const leaves = (value: unknown): number => typeof value === "string" || typeof value === "function" ? 1 : value && typeof value === "object" ? Object.values(value).reduce((sum, item) => sum + leaves(item), 0) : 0;
  assert.equal(defaultCrmUiDictionary.locale, "pt-PT");
  assert.ok(leaves(defaultCrmUiDictionary) >= 120);
  assert.equal(defaultCrmUiDictionary.stages.lead, "Novo");
  assert.equal(defaultCrmUiDictionary.report.eyebrow, "Relatório operacional");
});

test("CRM UI files use package theme utilities without MQ-local styling", () => {
  const directory = join(process.cwd(), "packages/module-crm/src/ui");
  const source = readdirSync(directory).filter((file) => /\.(ts|tsx)$/.test(file)).map((file) => readFileSync(join(directory, file), "utf8")).join("\n");
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(source, /\bfont-medium\b/);
  assert.doesNotMatch(source, /\bportal-/);
  assert.doesNotMatch(source, /\bproject-(?:surface|item|hero)/);
});

test("CRM controller hooks and host event contract are exported", () => {
  for (const hook of [useCrmDashboardController, useCrmDataSync, useCrmDerivedState, useCrmContactActions, useCrmOrganizationActions, useCrmBulkActions, useCrmMutations, useCrmWindowEvents]) assert.equal(typeof hook, "function");
  assert.equal(CRM_UI_EVENTS.openTimeline, "brightweb:crm:open-timeline");
});
