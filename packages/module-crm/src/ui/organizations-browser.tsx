"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, ExternalLink } from "lucide-react";
import { createLatestRequestController, isAbortError } from "@brightweblabs/infra/request-observability";
import {
  Badge,
  Button,
  EmptyState,
  SearchField,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  SurfaceCard,
} from "@brightweblabs/ui";

import { defaultCrmUiDictionary } from "./dictionary";
import type { CrmOrganization, CrmOrganizationFieldConfig, CrmUiDictionary } from "./types";
import type { CrmOrganizationsListResult } from "../data";

export const CRM_SHEET_CLASS_NAME = "h-screen w-full gap-0 border-l border-hairline bg-background sm:max-w-[var(--crm-sheet-width)]";

export type CrmOrganizationsBrowserProps = {
  open: boolean;
  organizations: CrmOrganization[];
  loading?: boolean;
  unavailable?: boolean;
  contactsByOrganization?: ReadonlyMap<string, number>;
  dictionary?: CrmUiDictionary;
  fields?: CrmOrganizationFieldConfig;
  onOpenChange: (open: boolean) => void;
  onSelect?: (organization: CrmOrganization) => void;
  queryOrganizations?: (params: { page: number; pageSize: number; search?: string }, options?: { signal?: AbortSignal }) => Promise<CrmOrganizationsListResult>;
};

export function CrmOrganizationsBrowser({ open, organizations, loading = false, unavailable = false, contactsByOrganization = new Map(), dictionary = defaultCrmUiDictionary, fields = {}, onOpenChange, onSelect, queryOrganizations }: CrmOrganizationsBrowserProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [remote, setRemote] = useState<CrmOrganizationsListResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryFailed, setQueryFailed] = useState(false);
  const requestRef = useRef(createLatestRequestController());
  const locallyFiltered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(dictionary.locale);
    return needle ? organizations.filter((organization) => organization.name?.toLocaleLowerCase(dictionary.locale).includes(needle)) : organizations;
  }, [dictionary.locale, organizations, search]);
  const visibleOrganizations = queryOrganizations ? remote?.items ?? organizations : locallyFiltered;
  const loadPage = useCallback(async (page: number, append: boolean) => {
    if (!queryOrganizations) return;
    const latest = requestRef.current.begin();
    setQueryLoading(true);
    setQueryFailed(false);
    try {
      const result = await queryOrganizations({ page, pageSize: 50, search: debouncedSearch || undefined }, { signal: latest.signal });
      if (!latest.isCurrent()) return;
      setRemote((current) => append && current
        ? { ...result, items: [...current.items, ...result.items] }
        : result);
    } catch (error) {
      if (latest.isCurrent() && !isAbortError(error)) setQueryFailed(true);
    } finally {
      const current = latest.isCurrent();
      latest.finish();
      if (current) setQueryLoading(false);
    }
  }, [debouncedSearch, queryOrganizations]);

  useEffect(() => {
    if (!open) return;
    if (!search.trim()) {
      setDebouncedSearch("");
      return;
    }
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [open, search]);

  useEffect(() => {
    if (open && queryOrganizations) void loadPage(1, false);
    else requestRef.current.abort();
    return () => requestRef.current.abort();
  }, [debouncedSearch, loadPage, open, queryOrganizations]);

  useEffect(() => () => requestRef.current.abort(), []);
  const config = { showIndustry: true, showCompanySize: true, showBudgetRange: true, showWebsite: true, showAddress: true, showTaxIdentifier: false, ...fields };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={CRM_SHEET_CLASS_NAME}>
        <SheetHeader className="border-b border-hairline p-5">
          <SheetTitle>{dictionary.organizations.title}</SheetTitle>
          <SheetDescription>{dictionary.organizations.subtitle}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          <SearchField value={search} onChange={setSearch} onClear={() => setSearch("")} placeholder={dictionary.organizations.searchPlaceholder} aria-label={dictionary.organizations.searchPlaceholder} />
          <div className="mt-4 grid gap-3" aria-busy={loading || queryLoading}>
            {visibleOrganizations.map((organization) => (
              <SurfaceCard key={organization.id} className="p-4">
                <button type="button" className="w-full text-left" onClick={() => onSelect?.(organization)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-body font-semibold text-foreground">{organization.name ?? dictionary.organizations.unavailable}</p>
                      {config.showIndustry ? <p className="mt-1 text-meta text-muted-foreground">{organization.industry ?? dictionary.organizations.unavailable}</p> : null}
                    </div>
                    {!queryOrganizations || contactsByOrganization.has(organization.id) ? (
                      <Badge variant="outline">{dictionary.organizations.contactCount(contactsByOrganization.get(organization.id) ?? 0)}</Badge>
                    ) : null}
                  </div>
                </button>
                <dl className="mt-3 grid gap-2 text-meta text-muted-foreground sm:grid-cols-2">
                  {config.showCompanySize ? <div><dt className="text-label text-foreground">{dictionary.organizations.companySize}</dt><dd>{organization.company_size ?? dictionary.organizations.unavailable}</dd></div> : null}
                  {config.showBudgetRange ? <div><dt className="text-label text-foreground">{dictionary.organizations.budgetRange}</dt><dd>{organization.budget_range ?? dictionary.organizations.unavailable}</dd></div> : null}
                  {config.showAddress ? <div><dt className="text-label text-foreground">{dictionary.organizations.address}</dt><dd>{organization.address ?? dictionary.organizations.unavailable}</dd></div> : null}
                  {config.showTaxIdentifier ? <div><dt className="text-label text-foreground">{fields.taxIdentifierLabel ?? dictionary.organizations.taxIdentifier}</dt><dd>{organization.taxIdentifierValue ?? dictionary.organizations.unavailable}</dd></div> : null}
                </dl>
                {config.showWebsite && organization.website_url ? <a href={organization.website_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-meta text-muted-foreground hover:text-foreground"><span className="truncate">{organization.website_url}</span><ExternalLink className="size-3" aria-hidden /></a> : null}
              </SurfaceCard>
            ))}
            {(loading || queryLoading) && visibleOrganizations.length === 0 ? <div className="grid gap-3">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-32 rounded-[var(--radius-card)]" />)}</div> : null}
            {(unavailable || queryFailed) && visibleOrganizations.length === 0 ? <p role="alert" className="min-h-32 rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/10 p-4 text-body text-destructive">{dictionary.dashboard.loadError}</p> : null}
            {!loading && !queryLoading && !unavailable && !queryFailed && visibleOrganizations.length === 0 ? <EmptyState icon={Building2} title={dictionary.organizations.emptyTitle} hint={dictionary.organizations.emptyHint} /> : null}
            {queryOrganizations && remote && remote.page < remote.totalPages ? (
              <Button type="button" variant="outline" disabled={queryLoading} onClick={() => void loadPage(remote.page + 1, true)}>
                {queryLoading ? "A carregar…" : "Carregar mais"}
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
