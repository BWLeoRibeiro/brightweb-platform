"use client";

import { useMemo } from "react";
import { Badge, Button, Skeleton } from "@brightweblabs/ui";
import { Trash2 } from "lucide-react";
import type { MarketingCampaignRecipient, MarketingUiDictionary } from "./types";

const recipientTone: Record<MarketingCampaignRecipient["status"], string> = {
  queued: "bg-muted text-muted-foreground",
  sending: "bg-warning/10 text-warning",
  sent: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  suppressed: "bg-muted text-muted-foreground",
  skipped: "bg-muted text-muted-foreground",
};

export function RecipientPanel({ recipients, loadState, dictionary, onRemove }: {
  recipients: MarketingCampaignRecipient[];
  loadState: "pending" | "fulfilled" | "rejected";
  dictionary: MarketingUiDictionary;
  onRemove?: (recipient: MarketingCampaignRecipient) => void;
}) {
  const counts = useMemo(() => {
    const next = { queued: 0, sending: 0, sent: 0, failed: 0, suppressed: 0, skipped: 0 };
    for (const recipient of recipients) next[recipient.status] += 1;
    return next;
  }, [recipients]);

  return (
    <section className="marketing-recipient-panel" aria-labelledby="marketing-recipients-title">
      <div>
        <p className="marketing-kicker" id="marketing-recipients-title">{dictionary.recipients.title}</p>
        <p className="mt-1 text-body text-muted-foreground">{dictionary.recipients.subtitle}</p>
      </div>
      {loadState === "pending" ? (
        <div className="marketing-count-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)}
        </div>
      ) : loadState === "fulfilled" ? (
        <div className="marketing-count-grid">
          {(Object.keys(counts) as Array<keyof typeof counts>).map((status) => (
            <div className="marketing-count" key={status}>
              <strong className="text-data text-[length:var(--text-heading-3)] font-semibold">{counts[status]}</strong>
              <span className="text-label">{dictionary.recipients.statuses[status]}</span>
            </div>
          ))}
        </div>
      ) : null}
      {loadState === "pending" ? (
        <div className="space-y-2" aria-busy="true" aria-label={dictionary.recipients.title}>
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : loadState === "rejected" ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-body text-destructive">
          {dictionary.feedback.genericError}
        </p>
      ) : recipients.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-body text-muted-foreground">
          {dictionary.recipients.empty}
        </p>
      ) : (
        <div className="marketing-recipient-list">
          {recipients.map((recipient) => (
            <div className="marketing-recipient-row" key={recipient.id}>
              <div className="min-w-0">
                <p className="truncate text-body font-semibold">{recipient.email}</p>
                {recipient.error ? <p className="truncate text-meta text-destructive">{recipient.error}</p> : null}
              </div>
              <Badge className={recipientTone[recipient.status]}>
                {dictionary.recipients.statuses[recipient.status]}
              </Badge>
              {["queued", "suppressed", "skipped"].includes(recipient.status) && onRemove ? (
                <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Remover ${recipient.email}`} onClick={() => onRemove(recipient)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
