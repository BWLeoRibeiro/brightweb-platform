"use client";

import { Clock3 } from "lucide-react";
import { ActivityMessage, EmptyState, Skeleton, SurfaceCard } from "@brightweblabs/ui";

import { composeCrmMessage, type CrmActivityDictionary } from "../activity-messages";
import type { CrmStatusLog } from "../data";
import { defaultCrmUiDictionary } from "./dictionary";
import type { CrmUiDictionary } from "./types";

export type CrmTimelineProps = {
  entries: CrmStatusLog[];
  loading?: boolean;
  dictionary?: CrmUiDictionary;
  activityDictionary?: CrmActivityDictionary;
  embedded?: boolean;
};

export function CrmTimeline({ entries, loading = false, dictionary = defaultCrmUiDictionary, activityDictionary = dictionary.activity, embedded = false }: CrmTimelineProps) {
  if (loading) {
    const content = <div className="grid gap-4" aria-label={dictionary.timeline.title}>{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>;
    return embedded ? content : <SurfaceCard className="p-5">{content}</SurfaceCard>;
  }
  if (entries.length === 0) {
    const content = <EmptyState icon={Clock3} title={dictionary.timeline.emptyTitle} hint={dictionary.timeline.emptyHint} />;
    return embedded ? content : <SurfaceCard>{content}</SurfaceCard>;
  }

  const content = (
      <ol className="flex flex-col pl-[var(--timeline-list-inset)]" aria-label={dictionary.timeline.title}>
        {entries.map((entry) => {
          const segments = composeCrmMessage({
            eventType: "crm_contact_status_changed",
            summary: entry.new_status,
            payload: {
              contact_name: entry.contact_label,
              changes: { status: { from: entry.previous_status, to: entry.new_status } },
            },
          }, entry.changed_by_label ?? dictionary.timeline.systemActor, activityDictionary);
          return (
            <li key={entry.id} className="relative flex gap-3 pb-4 text-ui-meta text-muted-foreground last:pb-0">
              <span className="absolute left-[var(--timeline-line-offset)] top-[var(--timeline-list-inset)] h-full w-px bg-hairline last:hidden" aria-hidden />
              <span className="relative z-10 mt-[var(--timeline-marker-offset)] size-2.5 shrink-0 rounded-full bg-[color:var(--crm-stage-lead)] ring-2 ring-card" aria-hidden />
              <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2"><p className="leading-snug"><ActivityMessage segs={segments} /></p>
              <time className="shrink-0 text-ui-micro" dateTime={entry.changed_at}>{new Intl.DateTimeFormat(dictionary.locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.changed_at))}</time></div>
              {entry.reason ? <p className="mt-1 text-ui-meta"><span className="font-semibold text-foreground">{dictionary.timeline.reasonLabel}:</span> {entry.reason}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
  );
  return embedded ? content : <SurfaceCard className="p-5">{content}</SurfaceCard>;
}
