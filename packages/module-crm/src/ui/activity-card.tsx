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
  locale,
  dictionary,
  systemActor,
}: {
  item: CrmStatusLog;
  isLast?: boolean;
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
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!isLast ? <span className="absolute left-[4.5px] top-[10px] h-full w-px bg-[color:var(--border)]" aria-hidden /> : null}
      <span
        className="relative z-10 mt-[5px] size-2.5 shrink-0 rounded-full ring-2 ring-[color:var(--card)]"
        style={{ backgroundColor: CRM_STAGE_TINTS[item.new_status] ?? "var(--muted-foreground)" }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="portal-meta leading-snug"><ActivityMessage segs={message} /></p>
          <time className="shrink-0 portal-micro font-normal" dateTime={item.changed_at}>{formatDateTime(item.changed_at, locale)}</time>
        </div>
        {item.reason ? <p className="mt-0.5 portal-micro leading-snug">{item.reason}</p> : null}
      </div>
    </li>
  );
}
