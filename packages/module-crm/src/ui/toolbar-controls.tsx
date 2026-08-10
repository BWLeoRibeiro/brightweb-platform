"use client";

import { useEffect, useState } from "react";
import { Building2, Filter, Plus, UserPlus } from "lucide-react";
import { ToolbarNewMenu, ToolbarSearchField, useShellActionDispatch, useShellActionReady, useShellActionsReady } from "@brightweblabs/app-shell";
import { Button, Popover, PopoverContent, PopoverTrigger, TooltipProvider } from "@brightweblabs/ui";

import type { CrmContactSort } from "../data";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import { CRM_UI_EVENTS } from "./hooks";
import type { CrmStageConfig, CrmUiDictionary } from "./types";

type CrmToolbarState = {
  search: string;
  status: string | null;
  sort: CrmContactSort;
};

type CrmOrganizationsToolbarState = {
  search: string;
  industry: string | null;
  sort: "name" | "industry" | "location";
  industries: string[];
};

export type CrmToolbarSearchChipProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  dictionary?: CrmUiDictionary;
};

export function CrmToolbarSearchChip({ value, onChange, disabled, dictionary = defaultCrmUiDictionary }: CrmToolbarSearchChipProps) {
  return <ToolbarSearchField value={value} onChange={onChange} disabled={disabled} placeholder={dictionary.table.searchPlaceholder} />;
}

export type CrmToolbarFiltersPillProps = {
  status: string | null;
  sort: CrmContactSort;
  stages?: CrmStageConfig[];
  dictionary?: CrmUiDictionary;
  disabled?: boolean;
  onApply: (status: string | null, sort: CrmContactSort) => void;
};

export function CrmToolbarFiltersPill({ status, sort, stages, dictionary = defaultCrmUiDictionary, disabled, onApply }: CrmToolbarFiltersPillProps) {
  const resolvedStages = resolveCrmStages(dictionary, stages);
  const [open, setOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string | null>(status);
  const [draftSort, setDraftSort] = useState<CrmContactSort>(sort);
  const activeCount = (status ? 1 : 0) + (sort !== "date_desc" ? 1 : 0);

  const begin = () => { setDraftStatus(status); setDraftSort(sort); setOpen(true); };
  return (
    <Popover open={open} onOpenChange={(next) => next ? begin() : setOpen(false)}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}>
          <Filter data-icon="inline-start" className="text-[color:var(--muted-foreground)]" aria-hidden />
          {dictionary.toolbar.filters}
          {activeCount > 0 ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-[color:var(--surface-button-brand)] text-data-sm text-accent-foreground">{activeCount}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12} className="w-[min(var(--toolbar-popover-width),calc(100vw-2rem))] rounded-[var(--radius-toolbar-popover)] border-[color:var(--hairline)] bg-[color:var(--popover)] p-4 shadow-[var(--shadow-toolbar-popover)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-body text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--foreground)]">{dictionary.toolbar.filters}</span>
          <Button type="button" variant="link" size="link" className="text-meta text-[color:var(--muted-foreground)]" onClick={() => { setDraftStatus(null); setDraftSort("date_desc"); }}>{dictionary.toolbar.clear}</Button>
        </div>
        <div className="grid gap-3">
          <div>
            <span className="mb-2 block text-label text-[color:var(--muted-foreground)]">{dictionary.toolbar.status}</span>
            <div className="flex flex-wrap gap-2">
              {[{ value: null, label: dictionary.table.allSegments }, ...resolvedStages.map((stage) => ({ value: stage.value, label: stage.label }))].map((option) => (
                <button key={option.value ?? "all"} type="button" className={`inline-flex h-[var(--toolbar-chip-height)] cursor-pointer items-center rounded-full border px-3 text-meta text-[length:var(--text-ui-chip)] font-semibold ${draftStatus === option.value ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)] text-[color:var(--foreground)]" : "border-[color:var(--hairline)] bg-[color:var(--elevate-1)] text-[color:var(--foreground)]"}`} onClick={() => setDraftStatus(option.value)}>{option.label}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 block text-label text-[color:var(--muted-foreground)]">{dictionary.toolbar.organize}</span>
            <div className="flex flex-wrap gap-2">
              {([
                ["date_desc", dictionary.table.sortNewest],
                ["name", dictionary.table.sortName],
                ["company", dictionary.table.sortCompany],
                ["status_grouped", dictionary.table.sortStatusGrouped ?? dictionary.toolbar.status],
                ["source_grouped", dictionary.table.sortSourceGrouped ?? "Origem (agrupado A → Z)"],
              ] as const).map(([value, label]) => <button key={value} type="button" className={`inline-flex h-[var(--toolbar-chip-height)] cursor-pointer items-center rounded-full border px-3 text-meta text-[length:var(--text-ui-chip)] font-semibold ${draftSort === value ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)] text-[color:var(--foreground)]" : "border-[color:var(--hairline)] bg-[color:var(--elevate-1)] text-[color:var(--foreground)]"}`} onClick={() => setDraftSort(value)}>{label}</button>)}
            </div>
          </div>
        </div>
        <div className="mt-4"><Button type="button" className="w-full" onClick={() => { onApply(draftStatus, draftSort); setOpen(false); }}>{dictionary.toolbar.apply}</Button></div>
      </PopoverContent>
    </Popover>
  );
}

export type CrmToolbarCreateMenuProps = { dictionary?: CrmUiDictionary; primary?: "contact" | "organization" };

export function CrmToolbarCreateMenu({ dictionary = defaultCrmUiDictionary, primary = "contact" }: CrmToolbarCreateMenuProps) {
  const dispatchShellAction = useShellActionDispatch();
  const createContactReady = useShellActionReady(CRM_UI_EVENTS.createContact);
  const createOrganizationReady = useShellActionReady(CRM_UI_EVENTS.createOrganization);
  const contactItem = { icon: UserPlus, label: dictionary.toolbar.newContact, disabled: !createContactReady, onSelect: () => dispatchShellAction(CRM_UI_EVENTS.createContact) };
  const organizationItem = { icon: Building2, label: dictionary.toolbar.newOrganization, disabled: !createOrganizationReady, onSelect: () => dispatchShellAction(CRM_UI_EVENTS.createOrganization) };
  return <TooltipProvider><ToolbarNewMenu id="crm-create-menu" icon={Plus} label={dictionary.toolbar.create} tooltip={dictionary.toolbar.create} disabled={!createContactReady && !createOrganizationReady} items={primary === "organization" ? [organizationItem, contactItem] : [contactItem, organizationItem]} /></TooltipProvider>;
}

export type CrmToolbarControlsProps = { dictionary?: CrmUiDictionary; stages?: CrmStageConfig[] };

export function CrmToolbarControls({ dictionary = defaultCrmUiDictionary, stages }: CrmToolbarControlsProps) {
  const dispatchShellAction = useShellActionDispatch();
  const filtersReady = useShellActionsReady([
    CRM_UI_EVENTS.setSearch,
    CRM_UI_EVENTS.selectSegment,
    CRM_UI_EVENTS.setSort,
  ]);
  const [state, setState] = useState<CrmToolbarState>({ search: "", status: null, sort: "date_desc" });
  useEffect(() => {
    const handleState = (event: Event) => setState((current) => ({ ...current, ...(event as CustomEvent<Partial<CrmToolbarState>>).detail }));
    window.addEventListener(CRM_UI_EVENTS.state, handleState);
    return () => window.removeEventListener(CRM_UI_EVENTS.state, handleState);
  }, []);
  return (
    <div className="flex min-w-max flex-wrap items-center gap-2">
      <CrmToolbarSearchChip value={state.search} disabled={!filtersReady} dictionary={dictionary} onChange={(search) => { setState((current) => ({ ...current, search })); dispatchShellAction(CRM_UI_EVENTS.setSearch, { search }); }} />
      <CrmToolbarFiltersPill status={state.status} sort={state.sort} disabled={!filtersReady} stages={stages} dictionary={dictionary} onApply={(status, sort) => { setState((current) => ({ ...current, status, sort })); dispatchShellAction(CRM_UI_EVENTS.selectSegment, { status }); dispatchShellAction(CRM_UI_EVENTS.setSort, { sort }); }} />
      <CrmToolbarCreateMenu dictionary={dictionary} />
    </div>
  );
}

export function CrmOrganizationsToolbarControls({ dictionary = defaultCrmUiDictionary }: { dictionary?: CrmUiDictionary }) {
  const dispatchShellAction = useShellActionDispatch();
  const filtersReady = useShellActionsReady([CRM_UI_EVENTS.organizationSetSearch, CRM_UI_EVENTS.organizationSetFilters]);
  const [state, setState] = useState<CrmOrganizationsToolbarState>({ search: "", industry: null, sort: "name", industries: [] });
  const [open, setOpen] = useState(false);
  const [draftIndustry, setDraftIndustry] = useState<string | null>(null);
  const [draftSort, setDraftSort] = useState<CrmOrganizationsToolbarState["sort"]>("name");
  const activeCount = (state.industry ? 1 : 0) + (state.sort !== "name" ? 1 : 0);

  useEffect(() => {
    const handleState = (event: Event) => setState((current) => ({ ...current, ...(event as CustomEvent<Partial<CrmOrganizationsToolbarState>>).detail }));
    window.addEventListener(CRM_UI_EVENTS.organizationState, handleState);
    return () => window.removeEventListener(CRM_UI_EVENTS.organizationState, handleState);
  }, []);

  const beginFilters = () => {
    setDraftIndustry(state.industry);
    setDraftSort(state.sort);
    setOpen(true);
  };

  return (
    <div className="flex min-w-max flex-wrap items-center gap-2">
      <ToolbarSearchField value={state.search} onChange={(search) => { setState((current) => ({ ...current, search })); dispatchShellAction(CRM_UI_EVENTS.organizationSetSearch, { search }); }} disabled={!filtersReady} placeholder={dictionary.organizations.searchPlaceholder} />
      <Popover open={open} onOpenChange={(next) => next ? beginFilters() : setOpen(false)}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" disabled={!filtersReady}>
            <Filter data-icon="inline-start" className="text-[color:var(--muted-foreground)]" aria-hidden />
            {dictionary.toolbar.filters}
            {activeCount > 0 ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-[color:var(--surface-button-brand)] text-data-sm text-accent-foreground">{activeCount}</span> : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" collisionPadding={12} className="w-[min(var(--toolbar-popover-width),calc(100vw-2rem))] rounded-[var(--radius-toolbar-popover)] border-[color:var(--hairline)] bg-[color:var(--popover)] p-4 shadow-[var(--shadow-toolbar-popover)]">
          <div className="mb-3 flex items-center justify-between"><span className="text-body font-extrabold text-[color:var(--foreground)]">{dictionary.toolbar.filters}</span><Button type="button" variant="link" size="link" className="text-meta text-[color:var(--muted-foreground)]" onClick={() => { setDraftIndustry(null); setDraftSort("name"); }}>{dictionary.toolbar.clear}</Button></div>
          <div className="grid gap-3">
            <div><span className="mb-2 block text-label text-[color:var(--muted-foreground)]">Indústria</span><div className="flex flex-wrap gap-2">{[{ value: null, label: "Todas" }, ...state.industries.map((industry) => ({ value: industry, label: industry }))].map((option) => <button key={option.value ?? "all"} type="button" className={`inline-flex h-[var(--toolbar-chip-height)] cursor-pointer items-center rounded-full border px-3 text-meta font-semibold ${draftIndustry === option.value ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)] text-[color:var(--foreground)]" : "border-[color:var(--hairline)] bg-[color:var(--elevate-1)] text-[color:var(--foreground)]"}`} onClick={() => setDraftIndustry(option.value)}>{option.label}</button>)}</div></div>
            <div><span className="mb-2 block text-label text-[color:var(--muted-foreground)]">Organizar por</span><div className="flex flex-wrap gap-2">{([['name', 'Nome'], ['industry', 'Indústria'], ['location', 'Localização']] as const).map(([value, label]) => <button key={value} type="button" className={`inline-flex h-[var(--toolbar-chip-height)] cursor-pointer items-center rounded-full border px-3 text-meta font-semibold ${draftSort === value ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)] text-[color:var(--foreground)]" : "border-[color:var(--hairline)] bg-[color:var(--elevate-1)] text-[color:var(--foreground)]"}`} onClick={() => setDraftSort(value)}>{label}</button>)}</div></div>
          </div>
          <div className="mt-4"><Button type="button" className="w-full" onClick={() => { const filters = { industry: draftIndustry, sort: draftSort }; setState((current) => ({ ...current, ...filters })); dispatchShellAction(CRM_UI_EVENTS.organizationSetFilters, filters); setOpen(false); }}>{dictionary.toolbar.apply}</Button></div>
        </PopoverContent>
      </Popover>
      <CrmToolbarCreateMenu dictionary={dictionary} primary="organization" />
    </div>
  );
}
