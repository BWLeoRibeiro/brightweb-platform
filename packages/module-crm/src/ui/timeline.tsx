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
};

export function CrmTimeline({ entries, loading = false, dictionary = defaultCrmUiDictionary, activityDictionary = dictionary.activity }: CrmTimelineProps) {
  if (loading) {
    return <SurfaceCard className="grid gap-4 p-5" aria-label={dictionary.timeline.title}>{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</SurfaceCard>;
  }
  if (entries.length === 0) {
    return <SurfaceCard><EmptyState icon={Clock3} title={dictionary.timeline.emptyTitle} hint={dictionary.timeline.emptyHint} /></SurfaceCard>;
  }

  return (
    <SurfaceCard className="p-5">
      <ol className="grid gap-5" aria-label={dictionary.timeline.title}>
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
            <li key={entry.id} className="relative border-l border-hairline pl-5 text-ui-body text-muted-foreground">
              <span className="absolute -left-1 top-1 size-2 rounded-full bg-[color:var(--crm-stage-lead)]" aria-hidden />
              <p><ActivityMessage segs={segments} /></p>
              <time className="mt-1 block text-ui-micro" dateTime={entry.changed_at}>{new Intl.DateTimeFormat(dictionary.locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.changed_at))}</time>
              {entry.reason ? <p className="mt-1 text-ui-meta"><span className="font-semibold text-foreground">{dictionary.timeline.reasonLabel}:</span> {entry.reason}</p> : null}
            </li>
          );
        })}
      </ol>
    </SurfaceCard>
  );
}
