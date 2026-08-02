import { ActivityMessage } from "@brightweblabs/ui";

import { composeCrmMessage, type CrmActivityDictionary } from "../activity-messages";
import type { CrmStatusLog } from "../data";

const CRM_STAGE_TINTS: Record<string, string> = {
  lead: "var(--crm-stage-lead)",
  qualified: "var(--crm-stage-qualified)",
  proposal: "var(--crm-stage-proposal)",
  won: "var(--crm-stage-won)",
  lost: "var(--crm-stage-lost)",
};

function formatDateTime(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function CrmActivityCard({
  item,
  isLast = false,
  compact = false,
  locale,
  dictionary,
  systemActor,
}: {
  item: CrmStatusLog;
  isLast?: boolean;
  compact?: boolean;
  locale: string;
  dictionary: CrmActivityDictionary;
  systemActor: string;
}) {
  const message = composeCrmMessage({
    eventType: "crm_contact_status_changed",
    summary: item.new_status,
    payload: {
      contact_name: item.contact_label,
      changes: { status: { from: item.previous_status, to: item.new_status } },
    },
  }, item.changed_by_label ?? systemActor, dictionary);

  return (
    <li className={`relative flex gap-3 ${compact ? "h-10 overflow-hidden" : "pb-4 last:pb-0"}`}>
      {!isLast ? <span className="absolute left-[var(--timeline-line-offset)] top-[var(--timeline-list-inset)] h-full w-px bg-[color:var(--border)]" aria-hidden /> : null}
      <span
        className="relative z-10 mt-[var(--timeline-marker-offset)] size-2.5 shrink-0 rounded-full ring-2 ring-[color:var(--card)]"
        style={{ backgroundColor: CRM_STAGE_TINTS[item.new_status] ?? "var(--muted-foreground)" }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-meta text-muted-foreground leading-snug ${compact ? "line-clamp-1" : ""}`}><ActivityMessage segs={message} /></p>
          <time className="shrink-0 text-data text-[length:var(--text-micro)] font-normal leading-[var(--type-leading-130)] text-muted-foreground" dateTime={item.changed_at}>{formatDateTime(item.changed_at, locale)}</time>
        </div>
        {item.reason ? <p className={`mt-0.5 text-micro text-muted-foreground leading-snug ${compact ? "line-clamp-1" : ""}`}>{item.reason}</p> : null}
      </div>
    </li>
  );
}
