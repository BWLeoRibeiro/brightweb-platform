import { clientTasksDictionary as copy } from "./dictionary";
import type { ClientTask } from "../../client-tasks-contracts";

const WORKFLOW_LABELS: Record<ClientTask["workflow"], string> = {
  open: copy.open, in_progress: copy.inProgress, submitted: copy.submitted, returned: copy.returned, accepted: copy.accepted,
};

export function ClientTaskState({ task }: { task: Pick<ClientTask, "workflow"> }) {
  return <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-meta font-semibold">{WORKFLOW_LABELS[task.workflow]}</span>;
}

export function ClientTaskResourceMessage({ state, refresh }: { state: string; refresh: () => Promise<void> }) {
  if (state === "loading") return <p role="status" className="text-body text-muted-foreground">{copy.loading}</p>;
  if (state === "unavailable") return <p role="status" className="text-body text-muted-foreground">{copy.unavailable}</p>;
  if (state === "error") return <div role="alert" className="space-y-2 text-body"><p>{copy.loadError}</p><button type="button" onClick={() => void refresh()} className="min-h-11 font-semibold text-primary underline">{copy.retry}</button></div>;
  return null;
}
