"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { EmptyState, SearchField, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@brightweblabs/ui";
import { createLatestRequestController, isAbortError } from "@brightweblabs/infra/request-observability";

import type { CrmStatusLog } from "../data";
import { defaultCrmUiDictionary } from "./dictionary";
import { CRM_SHEET_CLASS_NAME } from "./organizations-browser";
import { CrmTimeline } from "./timeline";
import type { CrmUiDictionary } from "./types";

export type CrmTimelineBrowserProps = {
  open: boolean;
  entries: CrmStatusLog[];
  loading?: boolean;
  unavailable?: boolean;
  dictionary?: CrmUiDictionary;
  onOpenChange: (open: boolean) => void;
  queryTimeline?: (params: { search?: string; limit?: number }, options?: { signal?: AbortSignal }) => Promise<CrmStatusLog[]>;
};

export function CrmTimelineBrowser({ open, entries, loading = false, unavailable = false, dictionary = defaultCrmUiDictionary, onOpenChange, queryTimeline }: CrmTimelineBrowserProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [remoteEntries, setRemoteEntries] = useState<CrmStatusLog[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [queryFailed, setQueryFailed] = useState(false);
  const requestRef = useRef(createLatestRequestController());
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(dictionary.locale);
    const source = queryTimeline ? remoteEntries ?? entries : entries;
    if (!needle || queryTimeline) return source;
    return source.filter((entry) => [entry.contact_label, entry.changed_by_label, entry.reason, dictionary.stages[entry.new_status as keyof typeof dictionary.stages]].filter(Boolean).join(" ").toLocaleLowerCase(dictionary.locale).includes(needle));
  }, [dictionary, entries, queryTimeline, remoteEntries, search]);

  useEffect(() => {
    if (!search.trim()) {
      setDebouncedSearch("");
      return;
    }
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!open || !queryTimeline) return;
    const latest = requestRef.current.begin();
    setRemoteLoading(true);
    setQueryFailed(false);
    void queryTimeline({ search: debouncedSearch || undefined, limit: 100 }, { signal: latest.signal })
      .then((result) => {
        if (latest.isCurrent()) setRemoteEntries(result);
      })
      .catch((error) => {
        if (!isAbortError(error) && latest.isCurrent()) setQueryFailed(true);
      })
      .finally(() => {
        const current = latest.isCurrent();
        latest.finish();
        if (current) setRemoteLoading(false);
      });
    return () => requestRef.current.abort();
  }, [debouncedSearch, open, queryTimeline]);

  useEffect(() => () => requestRef.current.abort(), []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={CRM_SHEET_CLASS_NAME}>
        <SheetHeader className="border-b border-hairline p-5">
          <SheetTitle>{dictionary.timeline.title}</SheetTitle>
          <SheetDescription>{dictionary.timeline.subtitle}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          <SearchField value={search} onChange={setSearch} onClear={() => setSearch("")} placeholder={dictionary.timeline.searchPlaceholder} aria-label={dictionary.timeline.searchPlaceholder} />
          <div className="mt-4">
            {search && filtered.length === 0 && !loading && !remoteLoading && !unavailable && !queryFailed ? <EmptyState icon={Clock3} title={dictionary.timeline.noResultsTitle} hint={dictionary.timeline.noResultsHint} /> : <CrmTimeline entries={filtered} loading={(loading || remoteLoading) && filtered.length === 0} unavailable={unavailable || queryFailed} dictionary={dictionary} />}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
