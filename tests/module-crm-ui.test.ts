import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShellActionsProvider } from "../packages/app-shell/src/lib/shell-actions.tsx";

import type { CrmContact, CrmContactsListResult, CrmStatusLog } from "../packages/module-crm/src/data.ts";
import { crmModuleRegistration } from "../packages/module-crm/src/registration.ts";
import { consumeCrmCreateIntent } from "../packages/module-crm/src/ui/create-intent.ts";
import {
  CrmContactDialog,
  CrmContactsTable,
  CrmDashboard,
  CrmDashboardSidebar,
  CrmDeleteDialog,
  CrmFunnelStats,
  CrmOrganizationsBrowser,
  CrmOrganizationSheet,
  CrmReport,
  CrmReportBanner,
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
  assert.doesNotThrow(() => renderToStaticMarkup(h(CrmOrganizationSheet, { open: false, onOpenChange: () => {}, onSubmit: () => {} })));
  assert.doesNotThrow(() => renderToStaticMarkup(h(CrmTimelineBrowser, { open: false, entries: timeline, onOpenChange: () => {} })));
  assert.match(renderToStaticMarkup(h(CrmReport, { data: report })), /Pulso do/);
  assert.match(renderToStaticMarkup(h(CrmReportPage, { initialData: report })), /Distribuição por estado/);
  assert.match(renderToStaticMarkup(h(CrmDashboard, { initialData: { contacts, stats: { total: 1, byStatus: { lead: 1 } }, owners: [], organizations: [], timeline } })), /Ada Lovelace/);
});

test("CRM timeline renders a retained contact deletion as a deletion event", () => {
  const deleted: CrmStatusLog = {
    id: "delete-1", contact_id: contact.id, previous_status: null, new_status: "", reason: null,
    changed_at: "2026-07-18T15:00:00.000Z", changed_by_user_id: "user-1", changed_by_label: "Sara Costa", contact_label: "Ada Lovelace",
    event_type: "crm_contact_deleted", summary: "Contacto CRM eliminado.", payload: { contact_name: "Ada Lovelace" },
  };
  const html = renderToStaticMarkup(h(CrmTimeline, { entries: [deleted] }));
  assert.match(html, /eliminou o contacto/);
  assert.match(html, /Ada Lovelace/);
  assert.doesNotMatch(html, /moveu o contacto/);
});

test("CRM dashboard follows the MQ table, right rail, and report hero composition", () => {
  const html = renderToStaticMarkup(h(CrmDashboard, { initialData: { contacts, stats: { total: 1, byStatus: { lead: 1 } }, owners: [], organizations: [{ id: "org-1", name: "Analytical Engines" }], timeline } }));
  assert.match(html, /Timeline/);
  assert.match(html, /Organizações/);
  assert.match(html, /Relatório do CRM/);
  assert.doesNotMatch(html, /Visão geral do funil/);
  assert.ok(html.indexOf("Ada Lovelace") < html.indexOf("Relatório do CRM"));
});

test("CRM contacts table remains edge-to-edge inside the shared card surface", () => {
  const html = renderToStaticMarkup(h(CrmContactsTable, { data: contacts }));

  assert.match(html, /^<article\b(?=[^>]*class="[^"]*!p-0[^"]*")(?=[^>]*data-density="none")[^>]*>/);
});

test("CRM summary consumers render pending state instead of transient empty UI", () => {
  const html = renderToStaticMarkup(h(CrmDashboard, { initialData: { contacts } }));
  assert.match(html, /aria-busy="true"/);
  assert.match(html, new RegExp(defaultCrmUiDictionary.report.loading));
  assert.doesNotMatch(html, new RegExp(defaultCrmUiDictionary.timeline.emptyHint));
  assert.doesNotMatch(html, new RegExp(defaultCrmUiDictionary.organizations.emptyTitle));
});

test("CRM summary consumers render empty UI only for fulfilled empty resources", () => {
  const html = renderToStaticMarkup(h(CrmDashboard, { initialData: { contacts, stats: { total: 0, byStatus: {} }, owners: [], organizations: [], timeline: [] } }));
  assert.match(html, new RegExp(defaultCrmUiDictionary.timeline.emptyHint));
  assert.match(html, new RegExp(defaultCrmUiDictionary.organizations.emptyTitle));
  assert.match(html, /Relatório do CRM/);
  assert.doesNotMatch(html, new RegExp(defaultCrmUiDictionary.report.loading));
});

test("CRM partial initial data resolves supplied empty resources and keeps only missing resources pending", () => {
  const html = renderToStaticMarkup(h(CrmDashboard, { initialData: { contacts, organizations: [] } }));
  assert.match(html, new RegExp(defaultCrmUiDictionary.organizations.emptyTitle));
  assert.doesNotMatch(html, new RegExp(defaultCrmUiDictionary.timeline.emptyHint));
  assert.match(html, new RegExp(defaultCrmUiDictionary.report.loading));
});

test("CRM retained summary content stays visible during refresh", () => {
  const organization = { id: "org-1", name: "Analytical Engines" };
  const otherOrganization = { id: "org-2", name: "Difference Engines" };
  const olderTimelineEntry = { ...timeline[0], id: "log-2", reason: "Older activity", changed_at: "2026-07-17T14:30:00.000Z" };
  const html = renderToStaticMarkup(h(CrmDashboardSidebar, {
    timelineEntries: [...timeline, olderTimelineEntry],
    organizations: [organization, otherOrganization],
    contactsByOrganization: new Map([[organization.id, 1]]),
    isRefreshing: true,
    isLoadingOrganizations: true,
    onOpenTimeline: () => {},
    onOpenOrganizations: () => {},
    onOpenOrganization: () => {},
  }));
  assert.match(html, /New enquiry/);
  assert.match(html, /Analytical Engines/);
  assert.match(html, /aria-label="2 Timeline"/);
  assert.match(html, /aria-label="2 Organizações"/);
  assert.doesNotMatch(html, /Older activity/);
  assert.doesNotMatch(html, /Difference Engines/);
  assert.doesNotMatch(html, new RegExp(defaultCrmUiDictionary.timeline.emptyHint));
  assert.doesNotMatch(html, new RegExp(defaultCrmUiDictionary.organizations.emptyTitle));

  const reportHtml = renderToStaticMarkup(h(CrmReportBanner, {
    summary: { qualifiedLast30Days: 2, wonLast30Days: 1, newLast7Days: 3, newLast30Days: 4, newLastYear: 5 },
    href: "/crm/report",
  }));
  assert.match(reportHtml, />2</);
  assert.match(reportHtml, />5</);
});

test("CRM rejected summary resources render unavailable UI rather than empty UI", () => {
  const html = renderToStaticMarkup(h(CrmDashboardSidebar, {
    timelineEntries: [],
    organizations: [],
    contactsByOrganization: new Map(),
    isRefreshing: false,
    isLoadingOrganizations: false,
    timelineUnavailable: true,
    organizationsUnavailable: true,
    onOpenTimeline: () => {},
    onOpenOrganizations: () => {},
    onOpenOrganization: () => {},
  }));
  assert.match(html, /role="alert"/);
  assert.match(html, new RegExp(defaultCrmUiDictionary.dashboard.loadError));
  assert.doesNotMatch(html, new RegExp(defaultCrmUiDictionary.timeline.emptyHint));
  assert.doesNotMatch(html, new RegExp(defaultCrmUiDictionary.organizations.emptyTitle));
});

test("CRM summary requests cannot let stale generations clear newer pending state", () => {
  const source = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/dashboard.tsx"), "utf8");
  assert.match(source, /const generation = \+\+summaryRequestGeneration\.current;[\s\S]*setSummaryResourceStates\([\s\S]*Promise\.all/);
  assert.match(source, /if \(generation !== summaryRequestGeneration\.current\) return;[\s\S]*status: "fulfilled"/);
  assert.match(source, /status: "rejected", hasData: current\[key\]\.hasData/);
  assert.match(source, /status === "pending" && !summaryResourceStates\.timeline\.hasData/);
});

test("CRM contact and organization details use right-side sheets instead of centered dialogs", () => {
  const contactSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/contact-dialog.tsx"), "utf8");
  const organizationSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/organization-sheet.tsx"), "utf8");
  assert.match(contactSource, /<Sheet open=/);
  assert.match(contactSource, /sheetShellClassName/);
  assert.match(contactSource, /sheetViewControlClassName/);
  assert.doesNotMatch(contactSource, /AlertDialog/);
  assert.match(organizationSource, /<Sheet open=/);
  assert.match(organizationSource, /SheetSection/);
});

test("CRM contact creation quick-creates an organization and resumes with it selected", () => {
  const contactSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/contact-dialog.tsx"), "utf8");
  const dashboardSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/dashboard.tsx"), "utf8");
  const organizationSheetSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/organization-sheet.tsx"), "utf8");

  assert.match(contactSource, /onCreateOrganization\?: \(input: CrmOrganizationWriteInput\) => Promise<CrmOrganizationOption>/);
  assert.match(contactSource, /<CrmOrganizationSheet[\s\S]*onSubmit=\{createOrganization\}/);
  assert.match(contactSource, /const created = await onCreateOrganization\(input\);[\s\S]*setOrganizationOptions[\s\S]*organization\.id !== created\.id[\s\S]*organizationId: created\.id/);
  assert.match(contactSource, /options=\{\[\{ value: "",[\s\S]*\.\.\.organizationOptions\.map/);
  assert.match(contactSource, /organizationToSelect\?: CrmOrganizationOption \| null/);
  assert.match(contactSource, /if \(!open \|\| !organizationToSelect\) return;[\s\S]*organizationId: organizationToSelect\.id/);
  assert.match(contactSource, /const merged = new Map[\s\S]*organizations\.forEach[\s\S]*return \[\.\.\.merged\.values\(\)\]/);
  assert.match(contactSource, /<Sheet open=\{open\}[\s\S]*<CrmOrganizationSheet/);
  assert.match(contactSource, /size="icon"[\s\S]*aria-label=\{dictionary\.organizations\.newTitle\}[\s\S]*<Plus className="size-4" \/>/);
  assert.match(dashboardSource, /setContactOrganizationToSelect\(saved\)/);
  assert.match(dashboardSource, /onCreateOrganization=\{createOrganizationForContact\} organizationToSelect=\{contactOrganizationToSelect\}/);
  assert.match(dashboardSource, /setOrganizations\([\s\S]*return saved;/);
  assert.match(organizationSheetSource, /OrganizationCreateSheet/);
  assert.match(organizationSheetSource, /invitations: input\.invitations/);
});

test("CRM organization cards expose full-card hover, pointer, and keyboard affordances", () => {
  const source = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/organizations-browser.tsx"), "utf8");
  const cardRecipe = readFileSync(join(process.cwd(), "packages/theme/src/surfaces.css"), "utf8");

  assert.match(source, /variant=\{onSelect \? "interactive" : "default"\}/);
  assert.match(cardRecipe, /\.card-root\[data-variant="interactive"\]:hover/);
  assert.match(cardRecipe, /cursor: pointer/);
  assert.match(source, /className="absolute inset-0 z-0 cursor-pointer rounded-\[var\(--radius-card\)\] outline-none focus-visible:ring-2/);
  assert.match(source, /aria-label=\{`\$\{dictionary\.organizations\.viewEyebrow\}: \$\{organization\.name/);
  assert.match(source, /className=\{onSelect \? "pointer-events-none relative z-10" : undefined\}/);
  assert.match(source, /className="relative z-20 mt-3 inline-flex/);
});

test("CRM edit sheets reject primitive close signals until the user explicitly exits editing", () => {
  const contactSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/contact-dialog.tsx"), "utf8");
  const organizationSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/organization-sheet.tsx"), "utf8");

  assert.match(contactSource, /onInteractOutside=\{\(event\) => \{[\s\S]*if \(mode !== "view"\) event\.preventDefault\(\)/);
  assert.match(organizationSource, /onInteractOutside=\{\(event\) => \{[\s\S]*if \(editing\) event\.preventDefault\(\)/);
  assert.match(contactSource, /if \(!nextOpen && mode !== "view"\) return;[\s\S]*<Sheet open=\{open\} onOpenChange=\{handleSheetOpenChange\}>/);
  assert.match(organizationSource, /if \(!nextOpen && editing\) return;[\s\S]*<Sheet open=\{open\} onOpenChange=\{handleSheetOpenChange\}>/);
  assert.match(contactSource, /showCloseButton=\{mode === "view"\}/);
  assert.match(organizationSource, /showCloseButton=\{!editing\}/);
});

test("CRM edit sheets cannot submit until an existing record has actually changed", () => {
  const contactSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/contact-dialog.tsx"), "utf8");
  const organizationSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/organization-sheet.tsx"), "utf8");

  assert.match(contactSource, /const hasChanges = mode === "create" \|\| hasContactChanges\(value, contact\)/);
  assert.match(contactSource, /normalizedPhone\(value\.phone\) !== normalizedPhone\(initial\.phone\)/);
  assert.match(contactSource, /onSubmit\(\{ \.\.\.value, phone: normalizedPhone\(value\.phone\) \}\)/);
  assert.match(contactSource, /if \(mode === "view" \|\| !hasChanges\) return/);
  assert.match(contactSource, /disabled=\{saving \|\| !hasChanges\}/);
  assert.match(organizationSource, /const hasChanges = mode === "create" \|\| hasOrganizationChanges\(value, organization\)/);
  assert.match(organizationSource, /!value\.name\?\.trim\(\) \|\| !hasChanges\) return/);
  assert.match(organizationSource, /disabled=\{saving \|\| !value\.name\?\.trim\(\) \|\| !hasChanges\}/);
});

test("CRM organization view exposes the website as a safe external link", () => {
  const organizationSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/organization-sheet.tsx"), "utf8");

  assert.match(organizationSource, /function organizationWebsiteHref/);
  assert.ok(organizationSource.includes('return /^https?:\\/\\//i.test(website) ? website : `https://${website}`;'));
  assert.match(organizationSource, /editing \? <Input[\s\S]*websiteHref \? <a/);
  assert.match(organizationSource, /href=\{websiteHref\} target="_blank" rel="noreferrer"/);
  assert.match(organizationSource, /cursor-pointer[^"]*hover:underline[^"]*focus-visible:ring-2/);
  assert.match(organizationSource, /<ExternalLink className="size-3\.5 shrink-0" aria-hidden/);
});

test("CRM organization danger zone aligns with the full-width sheet sections", () => {
  const organizationSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/organization-sheet.tsx"), "utf8");

  assert.match(organizationSource, /className="w-full rounded-\[var\(--radius-card\)\] border border-destructive\/30/);
  assert.doesNotMatch(organizationSource, /className="mx-4 rounded-xl border border-destructive\/30/);
});

test("CRM sheets consume the canonical natural-case typography recipes", () => {
  const contactSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/contact-dialog.tsx"), "utf8");
  const organizationSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/organization-sheet.tsx"), "utf8");
  const appSheetSource = readFileSync(join(process.cwd(), "packages/app-shell/src/components/app-sheet.tsx"), "utf8");
  const accountMenuSource = readFileSync(join(process.cwd(), "packages/app-shell/src/components/account-menu.tsx"), "utf8");

  assert.match(contactSource, /sheetFieldLabelClassName/);
  assert.match(organizationSource, /sheetFieldLabelClassName/);
  assert.doesNotMatch(contactSource, /text-micro uppercase tracking-wider/);
  assert.doesNotMatch(organizationSource, /text-micro uppercase tracking-wider/);
  assert.match(appSheetSource, /normal-case tracking-normal/);
  assert.match(appSheetSource, /text-heading-4/);
  assert.match(accountMenuSource, /block truncate text-meta/);
});

test("CRM contact and organization fields have stable accessible-name associations", () => {
  const contactSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/contact-dialog.tsx"), "utf8");
  const organizationSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/organization-sheet.tsx"), "utf8");
  const assertAssociated = (source: string, suffixes: string[]) => {
    assert.match(source, /const fieldId = useId\(\)/);
    for (const suffix of suffixes) {
      assert.ok(source.includes('htmlFor={`${fieldId}-' + suffix + '`}'), `missing label association for ${suffix}`);
      assert.ok(source.includes('id={`${fieldId}-' + suffix + '`}'), `missing control id for ${suffix}`);
    }
  };

  assertAssociated(contactSource, ["first-name", "last-name", "email", "phone", "organization", "owner"]);
  assertAssociated(organizationSource, ["name", "industry", "website", "tax-identifier", "address", "company-size", "budget-range"]);
  assert.match(contactSource, /<PhoneInput id=\{`\$\{fieldId\}-phone`\} name="phone" autoComplete="tel"/);
});

test("CRM shell toolbar controls are exported as independent surfaces", () => {
  assert.match(renderToStaticMarkup(h(CrmToolbarSearchChip, { value: "", onChange: () => {} })), /Procurar contactos/);
  assert.match(renderToStaticMarkup(h(CrmToolbarFiltersPill, { status: null, sort: "date_desc", onApply: () => {} })), /Filtros/);
  const createMenu = renderToStaticMarkup(h(ShellActionsProvider, null, h(CrmToolbarCreateMenu)));
  assert.match(createMenu, /Criar/);
  assert.match(createMenu, /disabled=""/);
  assert.deepEqual(crmModuleRegistration.toolbarActions?.crm?.map((item) => item.action), ["crm-search", "crm-filters", "crm-create-menu"]);
  const toolbarSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/toolbar-controls.tsx"), "utf8");
  assert.match(toolbarSource, /status_grouped/);
  assert.match(toolbarSource, /source_grouped/);
  assert.match(toolbarSource, /useShellActionsReady/);
  assert.match(toolbarSource, /createContactReady/);
  assert.match(toolbarSource, /createOrganizationReady/);
  assert.match(toolbarSource, /disabled=\{!createContactReady && !createOrganizationReady\}/);
  assert.ok(crmModuleRegistration.toolbarRoutes?.some((route) => route.surface === "crm-organizations"));
  const organizationWorkspaceSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/organization-workspace-sheet.tsx"), "utf8");
  assert.match(organizationWorkspaceSource, /<PillTabs ariaLabel="Organização"/);
  assert.match(organizationWorkspaceSource, /label: `Membros · \$\{access\.members\.length\}`/);
  assert.match(organizationWorkspaceSource, /Se já existir uma conta, o acesso é adicionado imediatamente/);
  assert.match(organizationWorkspaceSource, /label: "Administrador"/);
  assert.match(organizationWorkspaceSource, /onOpenContact\?\.\(contact\)/);
  assert.equal(defaultCrmUiDictionary.table.searchPlaceholder, "Procurar contactos…");
});

test("CRM organization links hand off from Contacts to the canonical Organizations workspace", () => {
  const dashboardSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/dashboard.tsx"), "utf8");
  const organizationsSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/organizations-page.tsx"), "utf8");
  assert.match(dashboardSource, /organizationsHref: "\/crm\/organizations"/);
  assert.match(dashboardSource, /contactsHref: "\/crm"/);
  assert.match(dashboardSource, /\?organization=\$\{encodeURIComponent\(organizationId\)\}/);
  assert.doesNotMatch(dashboardSource, /CrmOrganizationWorkspaceSheet/);
  assert.doesNotMatch(dashboardSource, /<CrmOrganizationSheet/);
  assert.match(dashboardSource, /searchParams\.set\("create", "organization"\)/);
  assert.match(dashboardSource, /searchParams\.get\("contact"\)/);
  assert.match(dashboardSource, /searchParams\.set\("contact", contact\.id\)/);
  assert.match(organizationsSource, /searchParams\.get\("organization"\)/);
  assert.match(organizationsSource, /searchParams\.set\("organization", organization\.id\)/);
  assert.match(organizationsSource, /consumeCrmCreateIntent\(window\.location\.href, "organization"\)/);
  assert.match(organizationsSource, /CRM_UI_EVENTS\.createContact/);
  assert.match(organizationsSource, /searchParams\.set\("create", "contact"\)/);
  assert.match(organizationsSource, /onOpenContact=\{openContact\}/);
  const contactsTableSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/contacts-table.tsx"), "utf8");
  assert.match(contactsTableSource, /onOrganizationClick\(contact\.organization_id!\)/);
  const dashboardClientSource = readFileSync(join(process.cwd(), "packages/app-shell/src/dashboard/dashboard-client.tsx"), "utf8");
  assert.match(dashboardClientSource, /\/crm\?contact=\$\{encodeURIComponent\(c\.id\)\}/);
});

test("CRM creation intents are consumed without dropping unrelated URL state", () => {
  assert.equal(
    consumeCrmCreateIntent("https://portal.example/crm/organizations?create=organization&source=toolbar#members", "organization"),
    "/crm/organizations?source=toolbar#members",
  );
  assert.equal(
    consumeCrmCreateIntent("https://portal.example/crm?create=contact", "contact"),
    "/crm",
  );
  assert.equal(
    consumeCrmCreateIntent("https://portal.example/crm?create=organization", "contact"),
    null,
  );

  const dashboardSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/dashboard.tsx"), "utf8");
  const organizationsSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/organizations-page.tsx"), "utf8");
  assert.match(dashboardSource, /onOpenChange=\{\(open\) => \{ if \(!open\) \{ clearContactCreateIntent\(\); selectContact\(null\); \}/);
  assert.match(organizationsSource, /onOpenChange=\{setOrganizationCreateOpen\}/);
});

test("CRM list requests debounce only search and expose pending state immediately", () => {
  const dashboardSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/dashboard.tsx"), "utf8");
  const clientSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/client.ts"), "utf8");
  const tableSource = readFileSync(join(process.cwd(), "packages/module-crm/src/ui/contacts-table.tsx"), "utf8");
  assert.match(dashboardSource, /setLoading\(true\)[\s\S]*window\.setTimeout\(\(\) => \{[\s\S]*setDebouncedSearch/);
  assert.match(dashboardSource, /contactsRequestAbort\.current\?\.abort\(\)/);
  assert.match(clientSource, /signal: requestOptions\.signal/);
  assert.match(tableSource, /aria-busy=\{loading\}/);
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
  assert.match(html, /text-data-sm font-normal text-muted-foreground[^>]*>18\/07</);
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

test("CRM UI files use canonical package typography utilities", () => {
  const directory = join(process.cwd(), "packages/module-crm/src/ui");
  const source = readdirSync(directory).filter((file) => /\.(ts|tsx)$/.test(file)).map((file) => readFileSync(join(directory, file), "utf8")).join("\n");
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(source, /\bfont-medium\b/);
  assert.match(source, /\btext-(?:heading-[1-4]|title|body|meta|label|micro|metric)\b/);
  assert.doesNotMatch(source, /(?<!--)\bportal-/);
  assert.match(source, /\bproject-(?:surface|item|hero)/);
});

test("CRM controller hooks and host event contract are exported", () => {
  for (const hook of [useCrmDashboardController, useCrmDataSync, useCrmDerivedState, useCrmContactActions, useCrmOrganizationActions, useCrmBulkActions, useCrmMutations, useCrmWindowEvents]) assert.equal(typeof hook, "function");
  assert.equal(CRM_UI_EVENTS.openTimeline, "brightweb:crm:open-timeline");
});

test("CRM organization search uses the shared Portuguese verb", () => {
  assert.equal(defaultCrmUiDictionary.organizations.searchPlaceholder, "Procurar organizações…");
});
