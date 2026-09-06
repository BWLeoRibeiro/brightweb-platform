"use client";

import { Badge, Skeleton } from "@brightweblabs/ui";
import type { MarketingUiDictionary, MarketingWorkflowRun } from "./types";

const runStatusTone: Record<MarketingWorkflowRun["status"], string> = {
  active: "border-info/25 bg-info/10 text-info",
  completed: "border-success/25 bg-success/10 text-success",
  failed: "border-destructive/25 bg-destructive/10 text-destructive",
  canceled: "border-border bg-muted text-muted-foreground",
};

function formatDateTime(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function WorkflowRunViewer({ runs, runsLoadState, dictionary }: {
  runs: MarketingWorkflowRun[];
  runsLoadState: "pending" | "fulfilled" | "rejected";
  dictionary: MarketingUiDictionary;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-heading-4">{dictionary.workflows.runs.title}</h3>
        <p className="text-body text-muted-foreground">{dictionary.workflows.runs.subtitle}</p>
      </div>
      {runsLoadState === "pending" ? (
        <div className="space-y-2" aria-busy="true" aria-label={dictionary.workflows.runs.title}>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : runsLoadState === "rejected" ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-body text-destructive">
          {dictionary.feedback.genericError}
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-body text-muted-foreground">
          {dictionary.workflows.runs.empty}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-body">
            <thead className="border-b bg-muted/40 text-meta text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">{dictionary.workflows.runs.contact}</th>
                <th className="px-4 py-3 font-semibold">{dictionary.workflows.runs.status}</th>
                <th className="px-4 py-3 font-semibold">{dictionary.workflows.runs.currentStep}</th>
                <th className="px-4 py-3 font-semibold">{dictionary.workflows.runs.nextRun}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-3">
                    <p className="text-body font-semibold">{run.contactName || run.contactEmail || "—"}</p>
                    {run.contactName && run.contactEmail ? (
                      <p className="text-meta text-muted-foreground">{run.contactEmail}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={runStatusTone[run.status]}>
                      {dictionary.workflows.runs.statuses[run.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-data">
                    {run.currentStep === null ? "—" : run.currentStep + 1}
                  </td>
                  <td className="px-4 py-3 text-data">{formatDateTime(run.nextRunAt, dictionary.locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
