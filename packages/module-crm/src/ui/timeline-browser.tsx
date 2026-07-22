"use client";

import { useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { EmptyState, SearchField, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@brightweblabs/ui";

import type { CrmStatusLog } from "../data";
import { defaultCrmUiDictionary } from "./dictionary";
import { CRM_SHEET_CLASS_NAME } from "./organizations-browser";
import { CrmTimeline } from "./timeline";
import type { CrmUiDictionary } from "./types";

export type CrmTimelineBrowserProps = {
  open: boolean;
  entries: CrmStatusLog[];
  loading?: boolean;
  dictionary?: CrmUiDictionary;
  onOpenChange: (open: boolean) => void;
};

export function CrmTimelineBrowser({ open, entries, loading = false, dictionary = defaultCrmUiDictionary, onOpenChange }: CrmTimelineBrowserProps) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(dictionary.locale);
    if (!needle) return entries;
    return entries.filter((entry) => [entry.contact_label, entry.changed_by_label, entry.reason, dictionary.stages[entry.new_status as keyof typeof dictionary.stages]].filter(Boolean).join(" ").toLocaleLowerCase(dictionary.locale).includes(needle));
  }, [dictionary, entries, search]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={CRM_SHEET_CLASS_NAME}>
        <SheetHeader className="border-b border-hairline p-5">
          <SheetTitle>{dictionary.timeline.title}</SheetTitle>
          <SheetDescription>{dictionary.timeline.subtitle}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <SearchField value={search} onChange={setSearch} onClear={() => setSearch("")} placeholder={dictionary.timeline.searchPlaceholder} aria-label={dictionary.timeline.searchPlaceholder} />
          <div className="mt-4">
            {search && filtered.length === 0 && !loading ? <EmptyState icon={Clock3} title={dictionary.timeline.noResultsTitle} hint={dictionary.timeline.noResultsHint} /> : <CrmTimeline entries={filtered} loading={loading} dictionary={dictionary} />}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
