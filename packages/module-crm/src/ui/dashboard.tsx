"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShellAction } from "@brightweblabs/app-shell";

import type { CrmContact, CrmContactsListParams, CrmContactsListResult, CrmContactStatusStats, CrmOwnerOption, CrmStatusLog } from "../data";
import type { CrmContactStatus } from "../server";
import { createCrmUiClient } from "./client";
import { consumeCrmCreateIntent } from "./create-intent";
import { CrmContactDialog } from "./contact-dialog";
import { CrmContactsTable } from "./contacts-table";
import { CrmDashboardSidebar } from "./dashboard-sidebar";
import { CrmDeleteDialog } from "./delete-dialog";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import { CRM_UI_EVENTS } from "./hooks";
import type { CrmOrganizationFormInput } from "./organization-sheet";
import { CrmStatusDialog } from "./status-dialog";
import { CrmTimelineBrowser } from "./timeline-browser";
import { CrmReportBanner, type CrmReportBannerSummary } from "./report-banner";
import type { CrmContactFormInput, CrmDashboardData, CrmDashboardSlots, CrmNavigationConfig, CrmOrganization, CrmOrganizationFieldConfig, CrmStageConfig, CrmTableColumnConfig, CrmUiClient, CrmUiDictionary } from "./types";

const emptyContacts: CrmContactsListResult = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };
const emptyStats: CrmContactStatusStats = { total: 0, byStatus: {} };
const defaultCrmNavigation: CrmNavigationConfig = {
  reportHref: "/crm/report",
  contactsHref: "/crm",
  organizationsHref: "/crm/organizations",
};

type SummaryResourceKey = "stats" | "owners" | "organizations" | "timeline";
type SummaryResourceState = { status: "pending" | "fulfilled" | "rejected"; hasData: boolean };
type SummaryResourceStates = Record<SummaryResourceKey, SummaryResourceState>;

const summaryResourceKeys: SummaryResourceKey[] = ["stats", "owners", "organizations", "timeline"];

function hasInitialResource(data: Partial<CrmDashboardData> | undefined, key: SummaryResourceKey) {
  return data?.[key] !== undefined;
}

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

export function CrmDashboard({ client: providedClient, initialData, dictionary = defaultCrmUiDictionary, columns, organizationFields, slots, stages, navigation = defaultCrmNavigation, pageSize = 20 }: CrmDashboardProps) {
  const client = useMemo(() => providedClient ?? createCrmUiClient(), [providedClient]);
  const resolvedStages = resolveCrmStages(dictionary, stages);
  const [params, setParams] = useState<CrmContactsListParams>({ page: 1, pageSize, sort: "date_desc" });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [contacts, setContacts] = useState(initialData?.contacts ?? { ...emptyContacts, pageSize });
  const [stats, setStats] = useState(initialData?.stats ?? emptyStats);
  const [owners, setOwners] = useState<CrmOwnerOption[]>(initialData?.owners ?? []);
  const [organizations, setOrganizations] = useState<CrmOrganization[]>(initialData?.organizations ?? []);
  const [timeline, setTimeline] = useState<CrmStatusLog[]>(initialData?.timeline ?? []);
  const [contactTimeline, setContactTimeline] = useState<CrmStatusLog[]>([]);
  const [loading, setLoading] = useState(!initialData?.contacts);
  const [contactsHasData, setContactsHasData] = useState(initialData?.contacts !== undefined);
  const [summaryResourceStates, setSummaryResourceStates] = useState<SummaryResourceStates>(() => Object.fromEntries(summaryResourceKeys.map((key) => [key, {
    status: hasInitialResource(initialData, key) ? "fulfilled" : "pending",
    hasData: hasInitialResource(initialData, key),
  }])) as SummaryResourceStates);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [contactsLoadFailed, setContactsLoadFailed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactOrganizationToSelect, setContactOrganizationToSelect] = useState<CrmOrganization | null>(null);
  const [statusTargets, setStatusTargets] = useState<string[]>([]);
  const [statusInitial, setStatusInitial] = useState<CrmContactStatus>("lead");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [contactTimelineOpen, setContactTimelineOpen] = useState(false);
  const skippedInitialContacts = useRef(Boolean(initialData?.contacts));
  const contactsRequestGeneration = useRef(0);
  const contactsRequestAbort = useRef<AbortController | null>(null);
  const searchDebouncePending = useRef(false);
  const summaryRequestGeneration = useRef(0);
  const summaryRequestAbort = useRef<AbortController | null>(null);
  const contactTimelineRequestGeneration = useRef(0);
  const contactTimelineRequestAbort = useRef<AbortController | null>(null);
  const summaryLoadFailed = summaryResourceKeys.some((key) => summaryResourceStates[key].status === "rejected");
  const loadFailed = contactsLoadFailed || summaryLoadFailed;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextHref = consumeCrmCreateIntent(window.location.href, "contact");
    if (!nextHref) return;
    setEditingContact(null);
    setContactOrganizationToSelect(null);
    setContactDialogOpen(true);
    window.history.replaceState(window.history.state, "", nextHref);
  }, []);

  const clearContactCreateIntent = () => {
    if (typeof window === "undefined") return;
    const nextHref = consumeCrmCreateIntent(window.location.href, "contact");
    if (nextHref) window.history.replaceState(window.history.state, "", nextHref);
  };

  useEffect(() => {
    if (typeof window === "undefined" || contacts.items.length === 0) return;
    const contactId = new URL(window.location.href).searchParams.get("contact");
    if (!contactId) return;
    const contact = contacts.items.find((item) => item.id === contactId);
    if (!contact) return;
    setEditingContact(contact);
    setContactOrganizationToSelect(null);
    setContactDialogOpen(true);
    void loadContactTimeline(contact.id);
  }, [contacts.items]);

  const requestParams = useMemo<CrmContactsListParams>(() => ({
    page: params.page,
    pageSize: params.pageSize,
    search: debouncedSearch || undefined,
    status: params.status,
    organizationId: params.organizationId,
    ownerProfileId: params.ownerProfileId,
    sort: params.sort,
  }), [debouncedSearch, params.organizationId, params.ownerProfileId, params.page, params.pageSize, params.sort, params.status]);

  const loadContacts = useCallback(async (nextParams: CrmContactsListParams) => {
    contactsRequestAbort.current?.abort();
    const controller = new AbortController();
    contactsRequestAbort.current = controller;
    const generation = ++contactsRequestGeneration.current;
    setLoading(true);
    try {
      const result = await client.listContacts(nextParams, { signal: controller.signal });
      if (generation === contactsRequestGeneration.current) {
        setContacts(result);
        setContactsHasData(true);
        setContactsLoadFailed(false);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (generation === contactsRequestGeneration.current) setContactsLoadFailed(true);
    } finally {
      if (contactsRequestAbort.current === controller) contactsRequestAbort.current = null;
      if (generation === contactsRequestGeneration.current) setLoading(false);
    }
  }, [client]);
  const loadSummary = useCallback(async (requestedKeys: SummaryResourceKey[] = summaryResourceKeys) => {
    summaryRequestAbort.current?.abort();
    const controller = new AbortController();
    summaryRequestAbort.current = controller;
    const generation = ++summaryRequestGeneration.current;
    setSummaryResourceStates((current) => ({
      ...current,
      ...Object.fromEntries(requestedKeys.map((key) => [key, { ...current[key], status: "pending" as const }])),
    }));
    const requests: Record<SummaryResourceKey, () => Promise<unknown>> = {
      stats: () => client.getStats({ signal: controller.signal }),
      owners: () => client.listOwners({ signal: controller.signal }),
      organizations: () => client.listOrganizations({ signal: controller.signal }),
      timeline: () => client.listTimeline(undefined, { signal: controller.signal }),
    };
    await Promise.all(requestedKeys.map(async (key) => {
      try {
        const value = await requests[key]();
        if (generation !== summaryRequestGeneration.current) return;
        if (key === "stats") setStats(value as CrmContactStatusStats);
        if (key === "owners") setOwners(value as CrmOwnerOption[]);
        if (key === "organizations") setOrganizations(value as CrmOrganization[]);
        if (key === "timeline") setTimeline(value as CrmStatusLog[]);
        setSummaryResourceStates((current) => generation === summaryRequestGeneration.current
          ? { ...current, [key]: { status: "fulfilled", hasData: true } }
          : current);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (generation !== summaryRequestGeneration.current) return;
        setSummaryResourceStates((current) => generation === summaryRequestGeneration.current
          ? { ...current, [key]: { status: "rejected", hasData: current[key].hasData } }
          : current);
      }
    }));
    if (summaryRequestAbort.current === controller) summaryRequestAbort.current = null;
  }, [client]);
  const loadContactTimeline = async (contactId: string) => {
    contactTimelineRequestAbort.current?.abort();
    const controller = new AbortController();
    contactTimelineRequestAbort.current = controller;
    const generation = ++contactTimelineRequestGeneration.current;
    setTimelineLoading(true);
    try {
      const result = await client.listTimeline(contactId, { signal: controller.signal });
      if (generation === contactTimelineRequestGeneration.current) setContactTimeline(result);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (generation === contactTimelineRequestGeneration.current) setContactTimeline([]);
    } finally {
      if (contactTimelineRequestAbort.current === controller) contactTimelineRequestAbort.current = null;
      if (generation === contactTimelineRequestGeneration.current) setTimelineLoading(false);
    }
  };

  useEffect(() => () => {
    contactsRequestAbort.current?.abort();
    summaryRequestAbort.current?.abort();
    contactTimelineRequestAbort.current?.abort();
  }, []);

  useEffect(() => {
    const missingKeys = summaryResourceKeys.filter((key) => !hasInitialResource(initialData, key));
    if (missingKeys.length === 0) return;
    void loadSummary(missingKeys);
  }, [client, loadSummary]);
  useEffect(() => {
    const normalizedSearch = params.search?.trim() ?? "";
    if (normalizedSearch === debouncedSearch) {
      if (searchDebouncePending.current) {
        searchDebouncePending.current = false;
        setLoading(false);
      }
      return;
    }
    contactsRequestAbort.current?.abort();
    contactsRequestAbort.current = null;
    contactsRequestGeneration.current += 1;
    setLoading(true);
    if (!normalizedSearch) {
      searchDebouncePending.current = false;
      setDebouncedSearch("");
      return;
    }
    searchDebouncePending.current = true;
    const timer = window.setTimeout(() => {
      searchDebouncePending.current = false;
      setDebouncedSearch(normalizedSearch);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [debouncedSearch, params.search]);
  useEffect(() => {
    if (skippedInitialContacts.current) { skippedInitialContacts.current = false; return; }
    void loadContacts(requestParams);
  }, [loadContacts, requestParams]);
  const refresh = async () => { await Promise.all([loadContacts({ ...params, search: params.search?.trim() || undefined }), loadSummary()]); };
  const selectContact = (contact: CrmContact | null) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (contact) url.searchParams.set("contact", contact.id);
      else url.searchParams.delete("contact");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    if (!contact) {
      setContactDialogOpen(false);
      setEditingContact(null);
      return;
    }
    setEditingContact(contact);
    setContactOrganizationToSelect(null);
    setContactDialogOpen(true);
    void loadContactTimeline(contact.id);
  };
  const saveContact = async (input: CrmContactFormInput) => {
    if (editingContact) await client.updateContact(editingContact.id, input); else await client.createContact(input);
    await refresh();
  };
  const openStatus = (ids: string[], initial: CrmContactStatus = "lead") => { setStatusTargets(ids); setStatusInitial(initial); setStatusDialogOpen(true); };
  const saveStatus = async (status: CrmContactStatus, reason?: string | null) => {
    await client.setStatus(statusTargets, status, reason); setSelectedIds([]); await refresh();
    if (editingContact && statusTargets.includes(editingContact.id)) await loadContactTimeline(editingContact.id);
  };
  const openDelete = (ids: string[]) => { setDeleteTargets(ids); setDeleteDialogOpen(true); };
  const deleteContacts = async (ids: string[]) => { await client.deleteContacts(ids); setSelectedIds([]); setContactDialogOpen(false); await refresh(); };
  const openOrganizationId = (organizationId: string) => {
    const collectionHref = navigation.organizationsHref ?? "/crm/organizations";
    const href = navigation.organizationHref?.(organizationId) ?? `${collectionHref}?organization=${encodeURIComponent(organizationId)}`;
    window.location.assign(href);
  };
  const openOrganization = (organization: CrmOrganization) => openOrganizationId(organization.id);
  const openOrganizations = () => window.location.assign(navigation.organizationsHref ?? "/crm/organizations");
  const createOrganization = () => {
    const url = new URL(navigation.organizationsHref ?? "/crm/organizations", window.location.origin);
    url.searchParams.set("create", "organization");
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  };
  const saveOrganization = async (input: CrmOrganizationFormInput, current?: CrmOrganization | null) => {
    const saved = current
      ? await client.updateOrganization(current.id, input)
      : await client.createOrganization(input);
    setOrganizations((items) => current
      ? items.map((item) => item.id === current.id ? saved : item)
      : [...items, saved]);
    return saved;
  };
  const createOrganizationForContact = async (input: CrmOrganizationFormInput) => {
    const saved = await saveOrganization(input);
    setContactOrganizationToSelect(saved);
    return saved;
  };
  const contactsByOrganization = useMemo(() => {
    const counts = new Map<string, number>();
    contacts.items.forEach((contact) => { if (contact.organization_id) counts.set(contact.organization_id, (counts.get(contact.organization_id) ?? 0) + 1); });
    return counts;
  }, [contacts.items]);
  const reportSummary = useMemo<CrmReportBannerSummary>(() => {
    if (stats.activity) return stats.activity;
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
  }, [contacts.items, stats.activity, timeline]);

  useShellAction(CRM_UI_EVENTS.createContact, () => { setEditingContact(null); setContactOrganizationToSelect(null); setContactDialogOpen(true); });
  useShellAction(CRM_UI_EVENTS.createOrganization, () => createOrganization());
  useShellAction(CRM_UI_EVENTS.refresh, () => { void refresh(); });
  useShellAction<{ search?: string } | undefined>(CRM_UI_EVENTS.setSearch, (detail) => setParams((current) => ({ ...current, search: detail?.search ?? "", page: 1 })));
  useShellAction<{ status?: CrmContactStatus | null } | undefined>(CRM_UI_EVENTS.selectSegment, (detail) => {
    setDebouncedSearch(params.search?.trim() ?? "");
    setParams((current) => ({ ...current, status: detail?.status ?? null, page: 1 }));
  });
  useShellAction<{ sort?: CrmContactsListParams["sort"] } | undefined>(CRM_UI_EVENTS.setSort, (detail) => {
    setDebouncedSearch(params.search?.trim() ?? "");
    setParams((current) => ({ ...current, sort: detail?.sort ?? "date_desc", page: 1 }));
  });

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(CRM_UI_EVENTS.state, { detail: { search: params.search ?? "", status: params.status ?? null, sort: params.sort ?? "date_desc" } }));
  }, [params.search, params.sort, params.status]);

  return (
    <div className="flex w-full flex-col gap-6 pt-0">
      {loadFailed ? <p role="alert" className="rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-body text-destructive">{dictionary.dashboard.loadError}</p> : null}
      {slots?.aboveStats}
      {slots?.besideStats}
      {slots?.aboveTable}
      <section className="grid w-full items-start gap-6 md:grid-cols-3">
        <div className="min-w-0 space-y-4 overflow-hidden md:col-span-2">
          <CrmContactsTable data={contacts} params={params} owners={owners} loading={loading} dictionary={dictionary} stages={resolvedStages} columns={columns} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} onParamsChange={setParams} onRowClick={selectContact} onOrganizationClick={openOrganizationId} onBulkStatus={(ids) => openStatus(ids)} onBulkDelete={openDelete} onQuickStatus={(contact, status) => openStatus([contact.id], status)} renderRowActions={slots?.rowActions} showToolbar={false} />
        </div>
        <div className="min-w-0 md:col-span-1">{slots?.sidebarTop}<CrmDashboardSidebar timelineEntries={timeline} organizations={organizations} contactsByOrganization={contactsByOrganization} isRefreshing={summaryResourceStates.timeline.status === "pending" && !summaryResourceStates.timeline.hasData} isLoadingOrganizations={summaryResourceStates.organizations.status === "pending" && !summaryResourceStates.organizations.hasData} timelineUnavailable={summaryResourceStates.timeline.status === "rejected" && !summaryResourceStates.timeline.hasData} organizationsUnavailable={summaryResourceStates.organizations.status === "rejected" && !summaryResourceStates.organizations.hasData} dictionary={dictionary} onOpenTimeline={() => setTimelineOpen(true)} onOpenOrganizations={openOrganizations} onOpenOrganization={openOrganization} />{slots?.sidebarBottom}</div>
      </section>
      {slots?.reportBanner ?? (navigation.reportHref ? <CrmReportBanner summary={reportSummary} href={navigation.reportHref} loading={(loading && !contactsHasData) || (summaryResourceStates.timeline.status === "pending" && !summaryResourceStates.timeline.hasData)} unavailable={(contactsLoadFailed && !contactsHasData) || (summaryResourceStates.timeline.status === "rejected" && !summaryResourceStates.timeline.hasData)} dictionary={dictionary} /> : null)}
      <CrmContactDialog open={contactDialogOpen} contact={editingContact} organizations={organizations} owners={owners} organizationsLoading={summaryResourceStates.organizations.status === "pending" && !summaryResourceStates.organizations.hasData} ownersLoading={summaryResourceStates.owners.status === "pending" && !summaryResourceStates.owners.hasData} organizationsUnavailable={summaryResourceStates.organizations.status === "rejected" && !summaryResourceStates.organizations.hasData} ownersUnavailable={summaryResourceStates.owners.status === "rejected" && !summaryResourceStates.owners.hasData} dictionary={dictionary} stages={resolvedStages} onOpenChange={(open) => { if (!open) { clearContactCreateIntent(); selectContact(null); } else setContactDialogOpen(true); }} onSubmit={saveContact} onCreateOrganization={createOrganizationForContact} organizationToSelect={contactOrganizationToSelect} onOrganizationSelectionApplied={(organizationId) => setContactOrganizationToSelect((current) => current?.id === organizationId ? null : current)} onTimeline={(contact) => { setEditingContact(contact); setContactDialogOpen(false); setContactTimelineOpen(true); }} onDelete={(contact) => { selectContact(null); openDelete([contact.id]); }} />
      <CrmStatusDialog open={statusDialogOpen} contactIds={statusTargets} initialStatus={statusInitial} dictionary={dictionary} stages={resolvedStages} onOpenChange={setStatusDialogOpen} onSubmit={saveStatus} />
      <CrmDeleteDialog open={deleteDialogOpen} contactIds={deleteTargets} dictionary={dictionary} onOpenChange={setDeleteDialogOpen} onConfirm={deleteContacts} />
      <CrmTimelineBrowser open={timelineOpen} entries={timeline} loading={summaryResourceStates.timeline.status === "pending" && !summaryResourceStates.timeline.hasData} unavailable={summaryResourceStates.timeline.status === "rejected" && !summaryResourceStates.timeline.hasData} dictionary={dictionary} onOpenChange={setTimelineOpen} queryTimeline={client.queryTimeline} />
      <CrmTimelineBrowser open={contactTimelineOpen} entries={contactTimeline} loading={timelineLoading} dictionary={dictionary} onOpenChange={setContactTimelineOpen} />
    </div>
  );
}
