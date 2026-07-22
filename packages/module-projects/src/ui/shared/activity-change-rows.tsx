import type { ActivityChange } from "@brightweblabs/ui/activity-format";
import { cn } from "../utils";

export function ActivityChangeRows({ changes, className }: { changes: ActivityChange[]; className?: string }) {
  if (changes.length === 0) return null;
  return <ul className={cn("mt-1.5 flex flex-col gap-1 border-l-2 border-[color:var(--border)] pl-xs", className)}>{changes.map((change) => <li key={change.key} className="portal-micro flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 font-normal"><span className="font-semibold text-[color:var(--foreground)]">{change.label}</span>{change.from || change.to ? <span className="inline-flex items-baseline gap-1.5 text-[color:var(--muted-foreground)]">{change.from ? <span className="line-through opacity-70">{change.from}</span> : null}{change.from && change.to ? <span aria-hidden>→</span> : null}{change.to ? <span className="font-semibold text-[color:var(--foreground)]">{change.to}</span> : null}</span> : <span className="text-[color:var(--muted-foreground)]">atualizado</span>}</li>)}</ul>;
}
