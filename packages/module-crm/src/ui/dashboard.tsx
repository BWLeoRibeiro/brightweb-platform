"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Building2, Clock3, Expand, Megaphone, Plus, UsersRound } from "lucide-react";
import { Badge, Button, SectionHeading, SurfaceCard } from "@brightweblabs/ui";

import type { CrmContact, CrmContactsListParams, CrmContactsListResult, CrmContactStatusStats, CrmOwnerOption, CrmStatusLog } from "../data";
import type { CrmContactStatus } from "../server";
import { createCrmUiClient } from "./client";
import { CrmContactDialog } from "./contact-dialog";
import { CrmContactsTable } from "./contacts-table";
import { CrmDeleteDialog } from "./delete-dialog";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import { CrmFunnelStats } from "./funnel-stats";
import { CrmOrganizationsBrowser } from "./organizations-browser";
import { CrmStatusDialog } from "./status-dialog";
import { CrmTimeline } from "./timeline";
import { CrmTimelineBrowser } from "./timeline-browser";
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
  const contactsByOrganization = useMemo(() => {
    const counts = new Map<string, number>();
    contacts.items.forEach((contact) => { if (contact.organization_id) counts.set(contact.organization_id, (counts.get(contact.organization_id) ?? 0) + 1); });
    return counts;
  }, [contacts.items]);

  return (
    <section className="grid gap-6">
      <SectionHeading icon={UsersRound} title={dictionary.dashboard.title} subtitle={dictionary.dashboard.subtitle} action={<div className="flex items-center gap-2">{navigation.marketingHref ? <Button href={navigation.marketingHref} type="button" variant="outline"><Megaphone className="size-4" aria-hidden />{dictionary.dashboard.marketing}</Button> : null}<Button type="button" onClick={() => { setEditingContact(null); setContactDialogOpen(true); }}><Plus className="size-4" aria-hidden />{dictionary.dashboard.addContact}</Button></div>} />
      {loadFailed ? <p role="alert" className="rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-ui-body text-destructive">{dictionary.dashboard.loadError}</p> : null}
      {slots?.reportBanner ?? (navigation.reportHref ? <SurfaceCard className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="flex min-w-0 items-start gap-3"><span className="section-icon" aria-hidden><BarChart3 className="size-3.5" /></span><div><p className="text-ui-label text-muted-foreground">{dictionary.dashboard.reportEyebrow}</p><p className="mt-1 text-ui-panel-title">{dictionary.dashboard.reportTitle}</p><p className="mt-1 text-ui-body text-muted-foreground">{dictionary.dashboard.reportDescription}</p></div></div><Button href={navigation.reportHref} variant="outline">{dictionary.dashboard.openReport}</Button></SurfaceCard> : null)}
      {slots?.aboveStats}
      <div className={slots?.besideStats ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]" : undefined}><CrmFunnelStats stats={stats} loading={loading && stats.total === 0} dictionary={dictionary} stages={resolvedStages} />{slots?.besideStats}</div>
      {slots?.aboveTable}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <CrmContactsTable data={contacts} params={params} owners={owners} loading={loading} dictionary={dictionary} stages={resolvedStages} columns={columns} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} onParamsChange={setParams} onRowClick={openContact} onBulkStatus={(ids) => openStatus(ids)} onBulkDelete={openDelete} onQuickStatus={(contact, status) => openStatus([contact.id], status)} renderRowActions={slots?.rowActions} />
        <aside className="grid content-start gap-4">
          {slots?.sidebarTop}
          <SurfaceCard className="p-4"><SectionHeading icon={Clock3} title={dictionary.timeline.title} subtitle={dictionary.timeline.subtitle} action={<Button type="button" variant="ghost" size="icon-sm" onClick={() => setTimelineOpen(true)} aria-label={dictionary.timeline.expand}><Expand className="size-3.5" aria-hidden /></Button>} /><div className="mt-4"><CrmTimeline entries={timeline.slice(0, 4)} loading={loading && timeline.length === 0} dictionary={dictionary} /></div></SurfaceCard>
          <SurfaceCard className="p-4"><SectionHeading icon={Building2} title={dictionary.organizations.title} subtitle={dictionary.organizations.subtitle} action={<Button type="button" variant="ghost" size="icon-sm" onClick={() => setOrganizationsOpen(true)} aria-label={dictionary.organizations.expand}><Expand className="size-3.5" aria-hidden /></Button>} /><div className="mt-4 grid gap-2">{organizations.slice(0, 5).map((organization) => <button key={organization.id} type="button" onClick={() => setOrganizationsOpen(true)} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-hairline bg-elevate-1 px-3 py-2 text-left"><span className="truncate text-ui-body font-semibold text-foreground">{organization.name}</span><Badge variant="outline">{contactsByOrganization.get(organization.id) ?? 0}</Badge></button>)}</div></SurfaceCard>
          {slots?.sidebarBottom}
        </aside>
      </div>
      <CrmContactDialog open={contactDialogOpen} contact={editingContact} organizations={organizations} owners={owners} dictionary={dictionary} stages={resolvedStages} onOpenChange={setContactDialogOpen} onSubmit={saveContact} onTimeline={(contact) => { setEditingContact(contact); setContactDialogOpen(false); setContactTimelineOpen(true); }} onDelete={(contact) => { setContactDialogOpen(false); openDelete([contact.id]); }} />
      <CrmStatusDialog open={statusDialogOpen} contactIds={statusTargets} initialStatus={statusInitial} dictionary={dictionary} stages={resolvedStages} onOpenChange={setStatusDialogOpen} onSubmit={saveStatus} />
      <CrmDeleteDialog open={deleteDialogOpen} contactIds={deleteTargets} dictionary={dictionary} onOpenChange={setDeleteDialogOpen} onConfirm={deleteContacts} />
      <CrmTimelineBrowser open={timelineOpen} entries={timeline} loading={timelineLoading} dictionary={dictionary} onOpenChange={setTimelineOpen} />
      <CrmTimelineBrowser open={contactTimelineOpen} entries={contactTimeline} loading={timelineLoading} dictionary={dictionary} onOpenChange={setContactTimelineOpen} />
      <CrmOrganizationsBrowser open={organizationsOpen} organizations={organizations} contactsByOrganization={contactsByOrganization} fields={organizationFields} dictionary={dictionary} onOpenChange={setOrganizationsOpen} />
    </section>
  );
}
