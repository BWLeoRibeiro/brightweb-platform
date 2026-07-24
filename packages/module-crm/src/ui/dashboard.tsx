"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CrmContact, CrmContactsListParams, CrmContactsListResult, CrmContactStatusStats, CrmOwnerOption, CrmStatusLog } from "../data";
import type { CrmContactStatus } from "../server";
import { createCrmUiClient } from "./client";
import { CrmContactDialog } from "./contact-dialog";
import { CrmContactsTable } from "./contacts-table";
import { CrmDashboardSidebar } from "./dashboard-sidebar";
import { CrmDeleteDialog } from "./delete-dialog";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import { CRM_UI_EVENTS } from "./hooks";
import { CrmOrganizationsBrowser } from "./organizations-browser";
import { CrmOrganizationSheet, type CrmOrganizationFormInput } from "./organization-sheet";
import { CrmStatusDialog } from "./status-dialog";
import { CrmTimelineBrowser } from "./timeline-browser";
import { CrmReportBanner, type CrmReportBannerSummary } from "./report-banner";
import type { CrmContactFormInput, CrmDashboardData, CrmDashboardSlots, CrmNavigationConfig, CrmOrganization, CrmOrganizationFieldConfig, CrmStageConfig, CrmTableColumnConfig, CrmUiClient, CrmUiDictionary } from "./types";

const emptyContacts: CrmContactsListResult = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };
const emptyStats: CrmContactStatusStats = { total: 0, byStatus: {} };

export type CrmDashboardProps = {
  client?: CrmUiClient;
  initialData?: Partial<CrmDashboardData>;
  dictionary?: CrmUiDictionary;
  columns?: CrmTableColumnConfig[];
  organizationFields?: CrmOrganizationFieldConfig;
  slots?: CrmDashboardSlots;
  stages?: CrmStageConfig[];
  navigation?: CrmNavigationConfig;
  pageSize?: number;
};

export function CrmDashboard({ client: providedClient, initialData, dictionary = defaultCrmUiDictionary, columns, organizationFields, slots, stages, navigation = { reportHref: "/crm/report" }, pageSize = 20 }: CrmDashboardProps) {
  const client = useMemo(() => providedClient ?? createCrmUiClient(), [providedClient]);
  const resolvedStages = resolveCrmStages(dictionary, stages);
  const [params, setParams] = useState<CrmContactsListParams>({ page: 1, pageSize, sort: "date_desc" });
  const [contacts, setContacts] = useState(initialData?.contacts ?? { ...emptyContacts, pageSize });
  const [stats, setStats] = useState(initialData?.stats ?? emptyStats);
  const [owners, setOwners] = useState<CrmOwnerOption[]>(initialData?.owners ?? []);
  const [organizations, setOrganizations] = useState<CrmOrganization[]>(initialData?.organizations ?? []);
  const [timeline, setTimeline] = useState<CrmStatusLog[]>(initialData?.timeline ?? []);
  const [contactTimeline, setContactTimeline] = useState<CrmStatusLog[]>([]);
  const [loading, setLoading] = useState(!initialData?.contacts);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [statusTargets, setStatusTargets] = useState<string[]>([]);
  const [statusInitial, setStatusInitial] = useState<CrmContactStatus>("lead");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [contactTimelineOpen, setContactTimelineOpen] = useState(false);
  const [organizationsOpen, setOrganizationsOpen] = useState(false);
  const [organizationSheetOpen, setOrganizationSheetOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<CrmOrganization | null>(null);
  const skippedInitialContacts = useRef(Boolean(initialData?.contacts));

  const loadContacts = async (nextParams: CrmContactsListParams) => {
    setLoading(true);
    try { setContacts(await client.listContacts(nextParams)); setLoadFailed(false); }
    catch { setLoadFailed(true); }
    finally { setLoading(false); }
  };
  const loadSummary = async () => {
    const results = await Promise.allSettled([client.getStats(), client.listOwners(), client.listOrganizations(), client.listTimeline()]);
    if (results[0].status === "fulfilled") setStats(results[0].value); else setLoadFailed(true);
    if (results[1].status === "fulfilled") setOwners(results[1].value); else setLoadFailed(true);
    if (results[2].status === "fulfilled") setOrganizations(results[2].value); else setLoadFailed(true);
    if (results[3].status === "fulfilled") setTimeline(results[3].value); else setLoadFailed(true);
  };

  useEffect(() => {
    if (initialData?.stats && initialData?.owners && initialData?.organizations && initialData?.timeline) return;
    void loadSummary();
  }, [client]);
  useEffect(() => {
    if (skippedInitialContacts.current) { skippedInitialContacts.current = false; return; }
    const timer = window.setTimeout(() => void loadContacts(params), params.search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [client, params]);

  const refresh = async () => { await Promise.all([loadContacts(params), loadSummary()]); };
  const openContact = (contact: CrmContact) => {
    setEditingContact(contact);
    setContactDialogOpen(true);
    setTimelineLoading(true);
    void client.listTimeline(contact.id).then(setContactTimeline).catch(() => setContactTimeline([])).finally(() => setTimelineLoading(false));
  };
  const saveContact = async (input: CrmContactFormInput) => {
    if (editingContact) await client.updateContact(editingContact.id, input); else await client.createContact(input);
    await refresh();
  };
  const openStatus = (ids: string[], initial: CrmContactStatus = "lead") => { setStatusTargets(ids); setStatusInitial(initial); setStatusDialogOpen(true); };
  const saveStatus = async (status: CrmContactStatus, reason?: string | null) => {
    await client.setStatus(statusTargets, status, reason); setSelectedIds([]); await refresh();
    if (editingContact && statusTargets.includes(editingContact.id)) setContactTimeline(await client.listTimeline(editingContact.id));
  };
  const openDelete = (ids: string[]) => { setDeleteTargets(ids); setDeleteDialogOpen(true); };
  const deleteContacts = async (ids: string[]) => { await client.deleteContacts(ids); setSelectedIds([]); setContactDialogOpen(false); await refresh(); };
  const openOrganization = (organization: CrmOrganization) => { setEditingOrganization(organization); setOrganizationsOpen(false); setOrganizationSheetOpen(true); };
  const createOrganization = () => { setEditingOrganization(null); setOrganizationsOpen(false); setOrganizationSheetOpen(true); };
  const saveOrganization = async (input: CrmOrganizationFormInput, current?: CrmOrganization | null) => {
    const saved = current
      ? await client.updateOrganization(current.id, input)
      : await client.createOrganization(input);
    setOrganizations((items) => current
      ? items.map((item) => item.id === current.id ? saved : item)
      : [...items, saved]);
  };
  const contactsByOrganization = useMemo(() => {
    const counts = new Map<string, number>();
    contacts.items.forEach((contact) => { if (contact.organization_id) counts.set(contact.organization_id, (counts.get(contact.organization_id) ?? 0) + 1); });
    return counts;
  }, [contacts.items]);
  const reportSummary = useMemo<CrmReportBannerSummary>(() => {
    const now = Date.now();
    const countSince = (days: number) => contacts.items.filter((contact) => now - new Date(contact.created_at).getTime() <= days * 86_400_000).length;
    const changedSince = (status: string, days: number) => timeline.filter((entry) => entry.new_status === status && now - new Date(entry.changed_at).getTime() <= days * 86_400_000).length;
    return {
      qualifiedLast30Days: changedSince("qualified", 30),
      wonLast30Days: changedSince("won", 30),
      newLast7Days: countSince(7),
      newLast30Days: countSince(30),
      newLastYear: countSince(365),
    };
  }, [contacts.items, timeline]);

  useEffect(() => {
    const createContact = () => { setEditingContact(null); setContactDialogOpen(true); };
    const openOrganizationList = () => createOrganization();
    const setSearch = (event: Event) => setParams((current) => ({ ...current, search: (event as CustomEvent<{ search?: string }>).detail?.search ?? "", page: 1 }));
    const setSegment = (event: Event) => setParams((current) => ({ ...current, status: (event as CustomEvent<{ status?: CrmContactStatus | null }>).detail?.status ?? null, page: 1 }));
    const setSort = (event: Event) => setParams((current) => ({ ...current, sort: (event as CustomEvent<{ sort?: CrmContactsListParams["sort"] }>).detail?.sort ?? "date_desc", page: 1 }));
    window.addEventListener(CRM_UI_EVENTS.createContact, createContact);
    window.addEventListener(CRM_UI_EVENTS.createOrganization, openOrganizationList);
    window.addEventListener(CRM_UI_EVENTS.setSearch, setSearch);
    window.addEventListener(CRM_UI_EVENTS.selectSegment, setSegment);
    window.addEventListener(CRM_UI_EVENTS.setSort, setSort);
    return () => {
      window.removeEventListener(CRM_UI_EVENTS.createContact, createContact);
      window.removeEventListener(CRM_UI_EVENTS.createOrganization, openOrganizationList);
      window.removeEventListener(CRM_UI_EVENTS.setSearch, setSearch);
      window.removeEventListener(CRM_UI_EVENTS.selectSegment, setSegment);
      window.removeEventListener(CRM_UI_EVENTS.setSort, setSort);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(CRM_UI_EVENTS.state, { detail: { search: params.search ?? "", status: params.status ?? null, sort: params.sort ?? "date_desc" } }));
  }, [params.search, params.sort, params.status]);

  return (
    <div className="flex w-full flex-col gap-6 pt-0">
      {loadFailed ? <p role="alert" className="rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-ui-body text-destructive">{dictionary.dashboard.loadError}</p> : null}
      {slots?.aboveStats}
      {slots?.besideStats}
      {slots?.aboveTable}
      <section className="grid w-full items-start gap-6 md:grid-cols-3">
        <div className="min-w-0 space-y-4 overflow-hidden md:col-span-2">
          <CrmContactsTable data={contacts} params={params} owners={owners} loading={loading} dictionary={dictionary} stages={resolvedStages} columns={columns} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} onParamsChange={setParams} onRowClick={openContact} onBulkStatus={(ids) => openStatus(ids)} onBulkDelete={openDelete} onQuickStatus={(contact, status) => openStatus([contact.id], status)} renderRowActions={slots?.rowActions} showToolbar={false} />
        </div>
        <div className="min-w-0 md:col-span-1">{slots?.sidebarTop}<CrmDashboardSidebar timelineEntries={timeline} organizations={organizations} contactsByOrganization={contactsByOrganization} isRefreshing={loading} isLoadingOrganizations={loading} dictionary={dictionary} onOpenTimeline={() => setTimelineOpen(true)} onOpenOrganizations={() => setOrganizationsOpen(true)} onOpenOrganization={openOrganization} />{slots?.sidebarBottom}</div>
      </section>
      {slots?.reportBanner ?? (navigation.reportHref ? <CrmReportBanner summary={reportSummary} href={navigation.reportHref} dictionary={dictionary} /> : null)}
      <CrmContactDialog open={contactDialogOpen} contact={editingContact} organizations={organizations} owners={owners} dictionary={dictionary} stages={resolvedStages} onOpenChange={setContactDialogOpen} onSubmit={saveContact} onTimeline={(contact) => { setEditingContact(contact); setContactDialogOpen(false); setContactTimelineOpen(true); }} onDelete={(contact) => { setContactDialogOpen(false); openDelete([contact.id]); }} />
      <CrmStatusDialog open={statusDialogOpen} contactIds={statusTargets} initialStatus={statusInitial} dictionary={dictionary} stages={resolvedStages} onOpenChange={setStatusDialogOpen} onSubmit={saveStatus} />
      <CrmDeleteDialog open={deleteDialogOpen} contactIds={deleteTargets} dictionary={dictionary} onOpenChange={setDeleteDialogOpen} onConfirm={deleteContacts} />
      <CrmTimelineBrowser open={timelineOpen} entries={timeline} loading={timelineLoading} dictionary={dictionary} onOpenChange={setTimelineOpen} />
      <CrmTimelineBrowser open={contactTimelineOpen} entries={contactTimeline} loading={timelineLoading} dictionary={dictionary} onOpenChange={setContactTimelineOpen} />
      <CrmOrganizationsBrowser open={organizationsOpen} organizations={organizations} contactsByOrganization={contactsByOrganization} fields={organizationFields} dictionary={dictionary} onOpenChange={setOrganizationsOpen} onSelect={openOrganization} />
      <CrmOrganizationSheet open={organizationSheetOpen} organization={editingOrganization} dictionary={dictionary} onOpenChange={setOrganizationSheetOpen} onSubmit={saveOrganization} />
    </div>
  );
}
