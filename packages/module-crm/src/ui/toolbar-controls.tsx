"use client";

import { useEffect, useState } from "react";
import { Filter, Plus, Search } from "lucide-react";
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
    <label className="flex h-10 items-center gap-2 rounded-full border border-hairline-strong bg-popover px-3 text-muted-foreground">
      <Search className="size-3.5 shrink-0" aria-hidden />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={dictionary.table.searchPlaceholder} aria-label={dictionary.table.searchPlaceholder} className="h-8 w-40 border-0 bg-transparent px-0 text-ui-meta shadow-none focus-visible:ring-0 xl:w-56" />
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
        <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline-strong bg-popover px-3 text-ui-meta font-semibold text-foreground/75 transition-colors hover:bg-surface-hover hover:text-foreground" onClick={() => open ? setOpen(false) : begin()}>
          <Filter className="size-3.5" aria-hidden />
          {dictionary.toolbar.filters}
          {activeCount > 0 ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-ui-micro text-accent-foreground">{activeCount}</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <span className="text-ui-panel-title">{dictionary.toolbar.filters}</span>
          <button type="button" className="text-ui-meta text-muted-foreground hover:text-foreground" onClick={() => { setDraftStatus(null); setDraftSort("date_desc"); }}>{dictionary.toolbar.clear}</button>
        </div>
        <div className="grid gap-4 p-4">
          <div className="grid gap-2">
            <span className="text-ui-label">{dictionary.toolbar.status}</span>
            <div className="flex flex-wrap gap-2">
              {[{ value: null, label: dictionary.table.allSegments }, ...resolvedStages.map((stage) => ({ value: stage.value, label: stage.label }))].map((option) => (
                <button key={option.value ?? "all"} type="button" className={`rounded-full border px-3 py-1.5 text-ui-meta ${draftStatus === option.value ? "border-accent bg-accent/10 text-foreground" : "border-hairline text-muted-foreground"}`} onClick={() => setDraftStatus(option.value)}>{option.label}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <span className="text-ui-label">{dictionary.toolbar.organize}</span>
            <div className="flex flex-wrap gap-2">
              {([
                ["date_desc", dictionary.table.sortNewest],
                ["name", dictionary.table.sortName],
                ["company", dictionary.table.sortCompany],
              ] as const).map(([value, label]) => <button key={value} type="button" className={`rounded-full border px-3 py-1.5 text-ui-meta ${draftSort === value ? "border-accent bg-accent/10 text-foreground" : "border-hairline text-muted-foreground"}`} onClick={() => setDraftSort(value)}>{label}</button>)}
            </div>
          </div>
        </div>
        <div className="border-t border-hairline p-3"><Button type="button" className="w-full" onClick={() => { onApply(draftStatus, draftSort); setOpen(false); }}>{dictionary.toolbar.apply}</Button></div>
      </PopoverContent>
    </Popover>
  );
}

export type CrmToolbarCreateMenuProps = { dictionary?: CrmUiDictionary };

export function CrmToolbarCreateMenu({ dictionary = defaultCrmUiDictionary }: CrmToolbarCreateMenuProps) {
  return <TooltipProvider><ToolbarNewMenu id="crm-create-menu" icon={Plus} label={dictionary.toolbar.create} tooltip={dictionary.toolbar.create} items={[
    { label: dictionary.toolbar.newContact, onSelect: () => window.dispatchEvent(new Event(CRM_UI_EVENTS.createContact)) },
    { label: dictionary.toolbar.newOrganization, onSelect: () => window.dispatchEvent(new Event(CRM_UI_EVENTS.createOrganization)) },
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
