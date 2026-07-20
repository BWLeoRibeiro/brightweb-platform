import assert from "node:assert/strict";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { CrmContact, CrmContactsListResult, CrmStatusLog } from "../packages/module-crm/src/data.ts";
import {
  CrmContactDialog,
  CrmContactsTable,
  CrmDashboard,
  CrmFunnelStats,
  CrmStatusDialog,
  CrmTimeline,
  defaultCrmUiDictionary,
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

test("CRM UI surfaces render from data without network access", () => {
  assert.match(renderToStaticMarkup(h(CrmFunnelStats, { stats: { total: 1, byStatus: { lead: 1 } } })), /Lead/);
  assert.match(renderToStaticMarkup(h(CrmContactsTable, { data: contacts })), /Ada Lovelace/);
  assert.match(renderToStaticMarkup(h(CrmTimeline, { entries: timeline })), /New enquiry/);
  assert.doesNotThrow(() => renderToStaticMarkup(h(CrmContactDialog, { open: false, onOpenChange: () => {}, onSubmit: () => {} })));
  assert.doesNotThrow(() => renderToStaticMarkup(h(CrmStatusDialog, { open: false, contactIds: [contact.id], onOpenChange: () => {}, onSubmit: () => {} })));
  assert.match(renderToStaticMarkup(h(CrmDashboard, { initialData: { contacts, stats: { total: 1, byStatus: { lead: 1 } }, owners: [], organizations: [] } })), /Ada Lovelace/);
});

test("CRM UI dictionary overrides every rendered label source", () => {
  const dictionary: CrmUiDictionary = {
    ...defaultCrmUiDictionary,
    table: { ...defaultCrmUiDictionary.table, searchPlaceholder: "Find people", columns: { ...defaultCrmUiDictionary.table.columns, name: "Person" } },
  };
  const html = renderToStaticMarkup(h(CrmContactsTable, { data: contacts, dictionary }));
  assert.match(html, /Find people/);
  assert.match(html, /Person/);
});

test("CRM column config can hide and relabel built-in columns", () => {
  const html = renderToStaticMarkup(h(CrmContactsTable, { data: contacts, columns: [{ key: "name", label: "Contact" }, { key: "email", hidden: true }] }));
  assert.match(html, /Contact/);
  assert.doesNotMatch(html, />Email</);
  assert.doesNotMatch(html, /ada@example\.com/);
});

test("CRM stage config controls order, labels, and token metadata", () => {
  const html = renderToStaticMarkup(h(CrmFunnelStats, { stats: { total: 1, byStatus: { lead: 1 } }, stages: [{ value: "lead", label: "Incoming", token: "--crm-stage-lead" }] }));
  assert.match(html, /Incoming/);
  assert.match(html, /var\(--crm-stage-lead-strong\)/);
  assert.doesNotMatch(html, /Qualified/);
});

test("CRM dashboard renders composition slots and row action render props", () => {
  const html = renderToStaticMarkup(h(CrmDashboard, {
    initialData: { contacts, stats: { total: 1, byStatus: { lead: 1 } }, owners: [], organizations: [] },
    slots: {
      aboveTable: h("p", null, "Above table slot"),
      besideStats: h("p", null, "Stats slot"),
      rowActions: (item) => h("button", null, `Open ${item.first_name}`),
    },
  }));
  assert.match(html, /Above table slot/);
  assert.match(html, /Stats slot/);
  assert.match(html, /Open Ada/);
});
