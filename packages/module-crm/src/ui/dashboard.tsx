"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import { Button, SectionHeading } from "@brightweblabs/ui";

import type { CrmContact, CrmContactsListParams, CrmContactsListResult, CrmContactStatusStats, CrmOwnerOption, CrmStatusLog } from "../data";
import type { CrmContactStatus } from "../server";
import { createCrmUiClient } from "./client";
import { CrmContactDialog } from "./contact-dialog";
import { CrmContactsTable } from "./contacts-table";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import { CrmFunnelStats } from "./funnel-stats";
import { CrmStatusDialog } from "./status-dialog";
import { CrmTimeline } from "./timeline";
import type { CrmContactFormInput, CrmDashboardData, CrmDashboardSlots, CrmOrganizationOption, CrmStageConfig, CrmTableColumnConfig, CrmUiClient, CrmUiDictionary } from "./types";

const emptyContacts: CrmContactsListResult = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };
const emptyStats: CrmContactStatusStats = { total: 0, byStatus: {} };

export type CrmDashboardProps = {
  client?: CrmUiClient;
  initialData?: Partial<CrmDashboardData>;
  dictionary?: CrmUiDictionary;
  columns?: CrmTableColumnConfig[];
  slots?: CrmDashboardSlots;
  stages?: CrmStageConfig[];
  pageSize?: number;
};

export function CrmDashboard({
  client: providedClient,
  initialData,
  dictionary = defaultCrmUiDictionary,
  columns,
  slots,
  stages,
  pageSize = 20,
}: CrmDashboardProps) {
  const client = useMemo(() => providedClient ?? createCrmUiClient(), [providedClient]);
  const resolvedStages = resolveCrmStages(dictionary, stages);
  const [params, setParams] = useState<CrmContactsListParams>({ page: 1, pageSize, sort: "date_desc" });
  const [contacts, setContacts] = useState(initialData?.contacts ?? { ...emptyContacts, pageSize });
  const [stats, setStats] = useState(initialData?.stats ?? emptyStats);
  const [owners, setOwners] = useState<CrmOwnerOption[]>(initialData?.owners ?? []);
  const [organizations, setOrganizations] = useState<CrmOrganizationOption[]>(initialData?.organizations ?? []);
  const [timeline, setTimeline] = useState<CrmStatusLog[]>([]);
  const [loading, setLoading] = useState(!initialData?.contacts);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [statusTargets, setStatusTargets] = useState<string[]>([]);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const skippedInitialContacts = useRef(Boolean(initialData?.contacts));

  const loadContacts = async (nextParams: CrmContactsListParams) => {
    setLoading(true);
    try {
      setContacts(await client.listContacts(nextParams));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    const results = await Promise.allSettled([client.getStats(), client.listOwners(), client.listOrganizations()]);
    if (results[0].status === "fulfilled") setStats(results[0].value); else setLoadFailed(true);
    if (results[1].status === "fulfilled") setOwners(results[1].value); else setLoadFailed(true);
    if (results[2].status === "fulfilled") setOrganizations(results[2].value); else setLoadFailed(true);
  };

  useEffect(() => {
    if (initialData?.stats && initialData?.owners && initialData?.organizations) return;
    void loadSummary();
  }, [client]);

  useEffect(() => {
    if (skippedInitialContacts.current) {
      skippedInitialContacts.current = false;
      return;
    }
    const timer = window.setTimeout(() => void loadContacts(params), params.search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [client, params]);

  const refresh = async () => {
    await Promise.all([loadContacts(params), loadSummary()]);
  };

  const openContact = (contact: CrmContact) => {
    setEditingContact(contact);
    setContactDialogOpen(true);
    setTimelineLoading(true);
    void client.listTimeline(contact.id)
      .then(setTimeline)
      .catch(() => setTimeline([]))
      .finally(() => setTimelineLoading(false));
  };

  const saveContact = async (input: CrmContactFormInput) => {
    if (editingContact) await client.updateContact(editingContact.id, input);
    else await client.createContact(input);
    await refresh();
  };

  const openStatus = (ids: string[]) => {
    setStatusTargets(ids);
    setStatusDialogOpen(true);
  };

  const saveStatus = async (status: CrmContactStatus, reason?: string | null) => {
    await client.setStatus(statusTargets, status, reason);
    setSelectedIds([]);
    await refresh();
    if (editingContact && statusTargets.includes(editingContact.id)) {
      setTimeline(await client.listTimeline(editingContact.id));
    }
  };

  return (
    <section className="grid gap-6">
      <SectionHeading
        icon={UsersRound}
        title={dictionary.dashboard.title}
        subtitle={dictionary.dashboard.subtitle}
        action={<Button type="button" onClick={() => { setEditingContact(null); setContactDialogOpen(true); }}><Plus className="size-4" aria-hidden />{dictionary.dashboard.addContact}</Button>}
      />
      {loadFailed ? <p role="alert" className="rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-ui-body text-destructive">{dictionary.dashboard.loadError}</p> : null}
      <div className={slots?.besideStats ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]" : undefined}>
        <CrmFunnelStats stats={stats} loading={loading && stats.total === 0} dictionary={dictionary} stages={resolvedStages} />
        {slots?.besideStats}
      </div>
      {slots?.aboveTable}
      <CrmContactsTable
        data={contacts}
        params={params}
        owners={owners}
        loading={loading}
        dictionary={dictionary}
        stages={resolvedStages}
        columns={columns}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onParamsChange={setParams}
        onRowClick={openContact}
        onBulkStatus={openStatus}
        renderRowActions={slots?.rowActions}
      />
      {editingContact ? <CrmTimeline entries={timeline} loading={timelineLoading} dictionary={dictionary} /> : null}
      <CrmContactDialog
        open={contactDialogOpen}
        contact={editingContact}
        organizations={organizations}
        owners={owners}
        dictionary={dictionary}
        stages={resolvedStages}
        onOpenChange={setContactDialogOpen}
        onSubmit={saveContact}
      />
      <CrmStatusDialog
        open={statusDialogOpen}
        contactIds={statusTargets}
        initialStatus={(editingContact?.status as CrmContactStatus | undefined) ?? "lead"}
        dictionary={dictionary}
        stages={resolvedStages}
        onOpenChange={setStatusDialogOpen}
        onSubmit={saveStatus}
      />
    </section>
  );
}
