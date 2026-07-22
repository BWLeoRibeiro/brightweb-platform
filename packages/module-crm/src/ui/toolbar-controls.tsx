"use client";

import { useEffect, useState } from "react";
import { Building2, Filter, Plus, Search, UserPlus } from "lucide-react";
import { ToolbarNewMenu } from "@brightweblabs/app-shell";
import { Button, Input, Popover, PopoverContent, PopoverTrigger, TooltipProvider } from "@brightweblabs/ui";

import type { CrmContactSort } from "../data";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import { CRM_UI_EVENTS } from "./hooks";
import type { CrmStageConfig, CrmUiDictionary } from "./types";

type CrmToolbarState = {
  search: string;
  status: string | null;
  sort: CrmContactSort;
};

function dispatchCrmDetail<T>(name: string, detail: T) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export type CrmToolbarSearchChipProps = {
  value: string;
  onChange: (value: string) => void;
  dictionary?: CrmUiDictionary;
};

export function CrmToolbarSearchChip({ value, onChange, dictionary = defaultCrmUiDictionary }: CrmToolbarSearchChipProps) {
  return (
    <label className="inline-flex h-9 min-w-[var(--toolbar-search-min-width)] items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-[color:var(--muted-foreground)]">
      <Search className="size-[var(--toolbar-icon-size)] shrink-0" aria-hidden />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={dictionary.table.searchPlaceholder} aria-label={dictionary.table.searchPlaceholder} className="h-8 w-full border-0 bg-transparent px-0 text-[length:var(--text-ui-action)] text-[color:var(--foreground)] shadow-none focus-visible:ring-0" />
    </label>
  );
}

export type CrmToolbarFiltersPillProps = {
  status: string | null;
  sort: CrmContactSort;
  stages?: CrmStageConfig[];
  dictionary?: CrmUiDictionary;
  onApply: (status: string | null, sort: CrmContactSort) => void;
};

export function CrmToolbarFiltersPill({ status, sort, stages, dictionary = defaultCrmUiDictionary, onApply }: CrmToolbarFiltersPillProps) {
  const resolvedStages = resolveCrmStages(dictionary, stages);
  const [open, setOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string | null>(status);
  const [draftSort, setDraftSort] = useState<CrmContactSort>(sort);
  const activeCount = (status ? 1 : 0) + (sort !== "date_desc" ? 1 : 0);

  const begin = () => { setDraftStatus(status); setDraftSort(sort); setOpen(true); };
  return (
    <Popover open={open} onOpenChange={(next) => next ? begin() : setOpen(false)}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--foreground)] transition-colors hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)]" onClick={() => open ? setOpen(false) : begin()}>
          <Filter className="size-[var(--toolbar-icon-size)] text-[color:var(--muted-foreground)]" aria-hidden />
          {dictionary.toolbar.filters}
          {activeCount > 0 ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-ui-micro text-accent-foreground">{activeCount}</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[var(--toolbar-popover-width)] rounded-[var(--radius-toolbar-popover)] border-[color:var(--hairline)] bg-[color:var(--popover)] p-4 shadow-[var(--shadow-toolbar-popover)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--foreground)]">{dictionary.toolbar.filters}</span>
          <button type="button" className="p-0 text-xs font-bold text-[color:var(--muted-foreground)] hover:text-[color:var(--accent)]" onClick={() => { setDraftStatus(null); setDraftSort("date_desc"); }}>{dictionary.toolbar.clear}</button>
        </div>
        <div className="grid gap-3">
          <div>
            <span className="mb-2 block text-[length:var(--text-ui-micro)] font-extrabold uppercase tracking-[0.1em] text-[color:var(--muted-foreground)]">{dictionary.toolbar.status}</span>
            <div className="flex flex-wrap gap-2">
              {[{ value: null, label: dictionary.table.allSegments }, ...resolvedStages.map((stage) => ({ value: stage.value, label: stage.label }))].map((option) => (
                <button key={option.value ?? "all"} type="button" className={`inline-flex h-[var(--toolbar-chip-height)] items-center rounded-full border px-3 text-[length:var(--text-ui-chip)] font-semibold ${draftStatus === option.value ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)] text-[color:var(--foreground)]" : "border-[color:var(--hairline)] bg-[color:var(--elevate-1)] text-[color:var(--foreground)]"}`} onClick={() => setDraftStatus(option.value)}>{option.label}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 block text-[length:var(--text-ui-micro)] font-extrabold uppercase tracking-[0.1em] text-[color:var(--muted-foreground)]">{dictionary.toolbar.organize}</span>
            <div className="flex flex-wrap gap-2">
              {([
                ["date_desc", dictionary.table.sortNewest],
                ["name", dictionary.table.sortName],
                ["company", dictionary.table.sortCompany],
              ] as const).map(([value, label]) => <button key={value} type="button" className={`inline-flex h-[var(--toolbar-chip-height)] items-center rounded-full border px-3 text-[length:var(--text-ui-chip)] font-semibold ${draftSort === value ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)] text-[color:var(--foreground)]" : "border-[color:var(--hairline)] bg-[color:var(--elevate-1)] text-[color:var(--foreground)]"}`} onClick={() => setDraftSort(value)}>{label}</button>)}
            </div>
          </div>
        </div>
        <div className="mt-4"><Button type="button" className="h-9 w-full rounded-[var(--radius-control)] bg-[color:var(--accent)] text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--accent-foreground)]" onClick={() => { onApply(draftStatus, draftSort); setOpen(false); }}>{dictionary.toolbar.apply}</Button></div>
      </PopoverContent>
    </Popover>
  );
}

export type CrmToolbarCreateMenuProps = { dictionary?: CrmUiDictionary };

export function CrmToolbarCreateMenu({ dictionary = defaultCrmUiDictionary }: CrmToolbarCreateMenuProps) {
  return <TooltipProvider><ToolbarNewMenu id="crm-create-menu" icon={Plus} label={dictionary.toolbar.create} tooltip={dictionary.toolbar.create} items={[
    { icon: UserPlus, label: dictionary.toolbar.newContact, onSelect: () => window.dispatchEvent(new Event(CRM_UI_EVENTS.createContact)) },
    { icon: Building2, label: dictionary.toolbar.newOrganization, onSelect: () => window.dispatchEvent(new Event(CRM_UI_EVENTS.createOrganization)) },
  ]} /></TooltipProvider>;
}

export type CrmToolbarControlsProps = { dictionary?: CrmUiDictionary; stages?: CrmStageConfig[] };

export function CrmToolbarControls({ dictionary = defaultCrmUiDictionary, stages }: CrmToolbarControlsProps) {
  const [state, setState] = useState<CrmToolbarState>({ search: "", status: null, sort: "date_desc" });
  useEffect(() => {
    const handleState = (event: Event) => setState((current) => ({ ...current, ...(event as CustomEvent<Partial<CrmToolbarState>>).detail }));
    window.addEventListener(CRM_UI_EVENTS.state, handleState);
    return () => window.removeEventListener(CRM_UI_EVENTS.state, handleState);
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CrmToolbarSearchChip value={state.search} dictionary={dictionary} onChange={(search) => { setState((current) => ({ ...current, search })); dispatchCrmDetail(CRM_UI_EVENTS.setSearch, { search }); }} />
      <CrmToolbarFiltersPill status={state.status} sort={state.sort} stages={stages} dictionary={dictionary} onApply={(status, sort) => { setState((current) => ({ ...current, status, sort })); dispatchCrmDetail(CRM_UI_EVENTS.selectSegment, { status }); dispatchCrmDetail(CRM_UI_EVENTS.setSort, { sort }); }} />
      <CrmToolbarCreateMenu dictionary={dictionary} />
    </div>
  );
}
