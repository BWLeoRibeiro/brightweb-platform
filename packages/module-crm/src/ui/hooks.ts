"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { CrmContact, CrmContactsListParams, CrmContactsListResult, CrmOwnerOption } from "../data";
import type { CrmContactStatus } from "../server";
import type { CrmContactFormInput, CrmDashboardData, CrmOrganization, CrmUiClient } from "./types";

export const CRM_UI_EVENTS = {
  createContact: "brightweb:crm:create-contact",
  openOrganizations: "brightweb:crm:open-organizations",
  openTimeline: "brightweb:crm:open-timeline",
  selectSegment: "brightweb:crm:select-segment",
} as const;

export function useCrmDashboardController(initialData?: Partial<CrmDashboardData>, pageSize = 20) {
  const [params, setParams] = useState<CrmContactsListParams>({ page: 1, pageSize, sort: "date_desc" });
  const [contacts, setContacts] = useState<CrmContactsListResult>(initialData?.contacts ?? { items: [], page: 1, pageSize, total: 0, totalPages: 1 });
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);
  return { params, setParams, contacts, setContacts, selectedContactIds, setSelectedContactIds, editingContact, setEditingContact };
}

export function useCrmDataSync({ client, params, enabled = true, onContacts, onError }: { client: CrmUiClient; params: CrmContactsListParams; enabled?: boolean; onContacts: (result: CrmContactsListResult) => void; onError?: (error: unknown) => void }) {
  const [loading, setLoading] = useState(enabled);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const result = await client.listContacts(params); onContacts(result); return result; }
    catch (error) { onError?.(error); throw error; }
    finally { setLoading(false); }
  }, [client, onContacts, onError, params]);
  useEffect(() => { if (enabled) void refresh().catch(() => undefined); }, [enabled, refresh]);
  return { loading, refresh };
}

export function useCrmDerivedState({ contacts, owners, organizations, selectedIds }: { contacts: CrmContact[]; owners: CrmOwnerOption[]; organizations: CrmOrganization[]; selectedIds: string[] }) {
  return useMemo(() => {
    const ownerLabelById = new Map(owners.map((owner) => [owner.id, owner.label]));
    const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
    const contactsByOrganization = new Map<string, number>();
    contacts.forEach((contact) => { if (contact.organization_id) contactsByOrganization.set(contact.organization_id, (contactsByOrganization.get(contact.organization_id) ?? 0) + 1); });
    const allVisibleIds = contacts.map((contact) => contact.id);
    return { ownerLabelById, organizationById, contactsByOrganization, allVisibleIds, allVisibleSelected: allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id)) };
  }, [contacts, organizations, owners, selectedIds]);
}

export function useCrmContactActions({ onCreate, onView }: { onCreate: () => void; onView: (contact: CrmContact) => void }) {
  return { openCreateContact: useCallback(onCreate, [onCreate]), openViewContact: useCallback(onView, [onView]) };
}

export function useCrmOrganizationActions({ onBrowse, onView }: { onBrowse: () => void; onView?: (organization: CrmOrganization) => void }) {
  return { openOrganizations: useCallback(onBrowse, [onBrowse]), openOrganization: useCallback((organization: CrmOrganization) => onView?.(organization), [onView]) };
}

export function useCrmBulkActions({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const toggleContactSelection = useCallback((contactId: string, selected: boolean) => onChange(selected ? Array.from(new Set([...selectedIds, contactId])) : selectedIds.filter((id) => id !== contactId)), [onChange, selectedIds]);
  const toggleSelectAllVisible = useCallback((contactIds: string[], selected: boolean) => onChange(selected ? Array.from(new Set([...selectedIds, ...contactIds])) : selectedIds.filter((id) => !contactIds.includes(id))), [onChange, selectedIds]);
  const clearSelection = useCallback(() => onChange([]), [onChange]);
  return { toggleContactSelection, toggleSelectAllVisible, clearSelection };
}

export function useCrmMutations(client: CrmUiClient, onComplete?: () => Promise<void> | void) {
  const [pending, setPending] = useState(false);
  const run = useCallback(async <T,>(action: () => Promise<T>) => { setPending(true); try { const result = await action(); await onComplete?.(); return result; } finally { setPending(false); } }, [onComplete]);
  return {
    pending,
    createContact: (input: CrmContactFormInput) => run(() => client.createContact(input)),
    updateContact: (contactId: string, input: CrmContactFormInput) => run(() => client.updateContact(contactId, input)),
    setStatus: (contactIds: string[], status: CrmContactStatus, reason?: string | null) => run(() => client.setStatus(contactIds, status, reason)),
    deleteContacts: (contactIds: string[]) => run(() => client.deleteContacts(contactIds)),
  };
}

export function useCrmWindowEvents(handlers: { onCreateContact?: () => void; onOpenOrganizations?: () => void; onOpenTimeline?: () => void; onSelectSegment?: (status: string | null) => void }) {
  useEffect(() => {
    const create = () => handlers.onCreateContact?.();
    const organizations = () => handlers.onOpenOrganizations?.();
    const timeline = () => handlers.onOpenTimeline?.();
    const segment = (event: Event) => handlers.onSelectSegment?.((event as CustomEvent<{ status?: string | null }>).detail?.status ?? null);
    window.addEventListener(CRM_UI_EVENTS.createContact, create);
    window.addEventListener(CRM_UI_EVENTS.openOrganizations, organizations);
    window.addEventListener(CRM_UI_EVENTS.openTimeline, timeline);
    window.addEventListener(CRM_UI_EVENTS.selectSegment, segment);
    return () => {
      window.removeEventListener(CRM_UI_EVENTS.createContact, create);
      window.removeEventListener(CRM_UI_EVENTS.openOrganizations, organizations);
      window.removeEventListener(CRM_UI_EVENTS.openTimeline, timeline);
      window.removeEventListener(CRM_UI_EVENTS.selectSegment, segment);
    };
  }, [handlers]);
}
