"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { useShellAction } from "@brightweblabs/app-shell";
import { Badge, EmptyState, Skeleton, SurfaceCard, Table, TableBody, TableCell, TableHead, TableHeader, TablePagination, TableRow } from "@brightweblabs/ui";
import { createCrmUiClient } from "./client";
import { CRM_UI_EVENTS } from "./hooks";
import { CrmOrganizationSheet, type CrmOrganizationFormInput } from "./organization-sheet";
import { CrmOrganizationWorkspaceSheet } from "./organization-workspace-sheet";
import type { CrmNavigationConfig, CrmOrganization, CrmUiClient } from "./types";

export function CrmOrganizationsPage({ client: providedClient, navigation }: { client?: CrmUiClient; navigation?: CrmNavigationConfig }) {
  const client = useMemo(() => providedClient ?? createCrmUiClient(), [providedClient]);
  const [organizations, setOrganizations] = useState<CrmOrganization[]>([]);
  const [contactCounts, setContactCounts] = useState(new Map<string, number>());
  const [selected, setSelected] = useState<CrmOrganization | null>(null);
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState<string | null>(null);
  const [sort, setSort] = useState<"name" | "industry" | "location">("name");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    Promise.all([client.listOrganizations(), client.listContacts({ page: 1, pageSize: 100, sort: "name" })]).then(([items, contacts]) => {
      if (!current) return;
      setOrganizations(items);
      const counts = new Map<string, number>();
      contacts.items.forEach((contact) => { if (contact.organization_id) counts.set(contact.organization_id, (counts.get(contact.organization_id) ?? 0) + 1); });
      setContactCounts(counts);
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client]);

  useEffect(() => {
    if (organizations.length === 0 || typeof window === "undefined") return;
    const organizationId = new URL(window.location.href).searchParams.get("organization");
    if (!organizationId) return;
    setSelected(organizations.find((organization) => organization.id === organizationId) ?? null);
  }, [organizations]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("create") !== "organization") return;
    setCreateOpen(true);
    url.searchParams.delete("create");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const selectOrganization = (organization: CrmOrganization | null) => {
    setSelected(organization);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (organization) url.searchParams.set("organization", organization.id);
    else url.searchParams.delete("organization");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const openContact = (contact: { id: string }) => {
    const url = new URL(navigation?.contactHref?.(contact.id) ?? navigation?.contactsHref ?? "/crm", window.location.origin);
    if (!navigation?.contactHref?.(contact.id)) url.searchParams.set("contact", contact.id);
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  };

  const industries = useMemo(() => Array.from(new Set(organizations.map((organization) => organization.industry).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "pt-PT")), [organizations]);
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-PT");
    const valueForSort = (organization: CrmOrganization) => sort === "industry" ? organization.industry : sort === "location" ? organization.address : organization.name;
    return organizations.filter((organization) => (!query || [organization.name, organization.industry, organization.address, organization.website_url].some((value) => value?.toLocaleLowerCase("pt-PT").includes(query))) && (!industry || organization.industry === industry)).sort((a, b) => (valueForSort(a) ?? "").localeCompare(valueForSort(b) ?? "", "pt-PT"));
  }, [industry, organizations, search, sort]);

  useShellAction(CRM_UI_EVENTS.createOrganization, () => setCreateOpen(true));
  useShellAction(CRM_UI_EVENTS.createContact, () => {
    const url = new URL(navigation?.contactsHref ?? "/crm", window.location.origin);
    url.searchParams.set("create", "contact");
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  });
  useShellAction<{ search?: string } | undefined>(CRM_UI_EVENTS.organizationSetSearch, (detail) => setSearch(detail?.search ?? ""));
  useShellAction<{ industry?: string | null; sort?: "name" | "industry" | "location" } | undefined>(CRM_UI_EVENTS.organizationSetFilters, (detail) => { setIndustry(detail?.industry ?? null); setSort(detail?.sort ?? "name"); });

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(CRM_UI_EVENTS.organizationState, { detail: { search, industry, sort, industries } }));
  }, [industries, industry, search, sort]);

  const createOrganization = async (input: CrmOrganizationFormInput) => {
    const created = await client.createOrganization(input);
    setOrganizations((items) => [...items, created]);
    setCreateOpen(false);
    selectOrganization(created);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col pb-8">
      <SurfaceCard isLight density="none" motion="none" aria-busy={loading} className={`h-[calc(100dvh-var(--crm-table-viewport-offset))] min-h-[var(--crm-table-min-height)] min-w-0 w-full max-w-full overflow-hidden bg-[color:var(--project-surface-primary)] !p-0 shadow-none transition-opacity duration-150 motion-reduce:transition-none ${loading && organizations.length > 0 ? "opacity-60" : ""}`}>
        <Table containerClassName="overflow-x-hidden" className={`table-fixed [&_tr]:border-[color:var(--hairline)] ${visible.length === 0 ? "h-full" : ""}`}><TableHeader><TableRow className="border-b border-[color:var(--hairline-strong)] bg-[color:var(--elevate-2)] hover:bg-[color:var(--elevate-2)] [&_th]:align-middle [&_th]:text-[color:var(--foreground)]"><TableHead className="text-label text-muted-foreground h-[var(--table-header-height)] w-[34%] px-[var(--table-cell-padding-x)]">Organização</TableHead><TableHead className="text-label text-muted-foreground h-[var(--table-header-height)] w-[22%] px-[var(--table-cell-padding-x)]">Indústria</TableHead><TableHead className="text-label text-muted-foreground h-[var(--table-header-height)] w-[24%] px-[var(--table-cell-padding-x)]">Localização</TableHead><TableHead className="text-label text-muted-foreground h-[var(--table-header-height)] w-[20%] px-[var(--table-cell-padding-x)]">Contactos</TableHead></TableRow></TableHeader><TableBody>
          {loading ? [0, 1, 2].map((index) => <TableRow key={index}><TableCell colSpan={4} className="px-[var(--table-cell-padding-x)] py-[var(--table-cell-padding-y)]"><Skeleton className="h-8 w-full" /></TableCell></TableRow>) : visible.map((organization) => <TableRow key={organization.id} tabIndex={0} className="cursor-pointer" onClick={() => selectOrganization(organization)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectOrganization(organization); }}><TableCell className="max-w-0 px-[var(--table-cell-padding-x)] py-[var(--table-cell-padding-y)]"><div className="min-w-0 space-y-0.5"><p className="truncate text-body font-semibold leading-tight text-[color:var(--foreground)]">{organization.name || "Sem nome"}</p><p className="truncate text-meta leading-tight text-[color:var(--muted-foreground)]">{organization.website_url || organization.id}</p></div></TableCell><TableCell className="max-w-0 px-[var(--table-cell-padding-x)] py-[var(--table-cell-padding-y)] text-body text-[color:var(--muted-foreground)]">{organization.industry || "—"}</TableCell><TableCell className="max-w-0 truncate px-[var(--table-cell-padding-x)] py-[var(--table-cell-padding-y)] text-body text-[color:var(--muted-foreground)]">{organization.address || "—"}</TableCell><TableCell className="px-[var(--table-cell-padding-x)] py-[var(--table-cell-padding-y)]"><Badge variant="outline" className="text-data-sm">{contactCounts.get(organization.id) ?? 0}</Badge></TableCell></TableRow>)}
          {!loading && visible.length === 0 ? <TableRow className="h-full"><TableCell colSpan={4} className="h-full p-0"><EmptyState icon={Building2} title="Sem organizações" hint="Não existem organizações para mostrar." /></TableCell></TableRow> : null}
        </TableBody></Table>
        {visible.length > 0 ? <TablePagination page={1} totalPages={1} onPageChange={() => undefined} summary={`${visible.length} organizações`} previousLabel="Anterior" nextLabel="Seguinte" pageLabel={(page, totalPages) => `Página ${page} de ${totalPages}`} /> : null}
      </SurfaceCard>
      <CrmOrganizationSheet open={createOpen} onOpenChange={setCreateOpen} onSubmit={createOrganization} />
      <CrmOrganizationWorkspaceSheet open={selected !== null} organization={selected} client={client} onOpenChange={(open) => { if (!open) selectOrganization(null); }} onOpenContact={openContact} onOrganizationChange={(updated) => { setSelected(updated); setOrganizations((items) => items.map((item) => item.id === updated.id ? updated : item)); }} />
    </div>
  );
}
