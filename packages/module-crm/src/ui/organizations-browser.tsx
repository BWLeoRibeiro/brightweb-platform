"use client";

import { useMemo, useState } from "react";
import { Building2, ExternalLink } from "lucide-react";
import {
  Badge,
  EmptyState,
  SearchField,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SurfaceCard,
} from "@brightweblabs/ui";

import { defaultCrmUiDictionary } from "./dictionary";
import type { CrmOrganization, CrmOrganizationFieldConfig, CrmUiDictionary } from "./types";

export const CRM_SHEET_CLASS_NAME = "h-screen w-full gap-0 border-l border-hairline bg-background sm:max-w-[var(--crm-sheet-width)]";

export type CrmOrganizationsBrowserProps = {
  open: boolean;
  organizations: CrmOrganization[];
  contactsByOrganization?: ReadonlyMap<string, number>;
  dictionary?: CrmUiDictionary;
  fields?: CrmOrganizationFieldConfig;
  onOpenChange: (open: boolean) => void;
  onSelect?: (organization: CrmOrganization) => void;
};

export function CrmOrganizationsBrowser({ open, organizations, contactsByOrganization = new Map(), dictionary = defaultCrmUiDictionary, fields = {}, onOpenChange, onSelect }: CrmOrganizationsBrowserProps) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(dictionary.locale);
    return needle ? organizations.filter((organization) => organization.name?.toLocaleLowerCase(dictionary.locale).includes(needle)) : organizations;
  }, [dictionary.locale, organizations, search]);
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
          <div className="mt-4 grid gap-3">
            {filtered.map((organization) => (
              <SurfaceCard key={organization.id} className="p-4">
                <button type="button" className="w-full text-left" onClick={() => onSelect?.(organization)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-ui-body font-semibold text-foreground">{organization.name ?? dictionary.organizations.unavailable}</p>
                      {config.showIndustry ? <p className="mt-1 text-ui-meta text-muted-foreground">{organization.industry ?? dictionary.organizations.unavailable}</p> : null}
                    </div>
                    <Badge variant="outline">{dictionary.organizations.contactCount(contactsByOrganization.get(organization.id) ?? 0)}</Badge>
                  </div>
                </button>
                <dl className="mt-3 grid gap-2 text-ui-meta text-muted-foreground sm:grid-cols-2">
                  {config.showCompanySize ? <div><dt className="text-ui-label text-foreground">{dictionary.organizations.companySize}</dt><dd>{organization.company_size ?? dictionary.organizations.unavailable}</dd></div> : null}
                  {config.showBudgetRange ? <div><dt className="text-ui-label text-foreground">{dictionary.organizations.budgetRange}</dt><dd>{organization.budget_range ?? dictionary.organizations.unavailable}</dd></div> : null}
                  {config.showAddress ? <div><dt className="text-ui-label text-foreground">{dictionary.organizations.address}</dt><dd>{organization.address ?? dictionary.organizations.unavailable}</dd></div> : null}
                  {config.showTaxIdentifier ? <div><dt className="text-ui-label text-foreground">{fields.taxIdentifierLabel ?? dictionary.organizations.taxIdentifier}</dt><dd>{organization.taxIdentifierValue ?? dictionary.organizations.unavailable}</dd></div> : null}
                </dl>
                {config.showWebsite && organization.website_url ? <a href={organization.website_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-ui-meta text-muted-foreground hover:text-foreground"><span className="truncate">{organization.website_url}</span><ExternalLink className="size-3" aria-hidden /></a> : null}
              </SurfaceCard>
            ))}
            {filtered.length === 0 ? <EmptyState icon={Building2} title={dictionary.organizations.emptyTitle} hint={dictionary.organizations.emptyHint} /> : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
