"use client";

import { CalendarClock, CheckCircle2, ChevronDown, History, Hourglass, Info, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useProjectDetailProject } from "./project-detail-data-provider";
import { portalMonoTabularClassName as MONO } from "./shared/typography";
import { Popover, PopoverContent, PopoverTrigger } from "@brightweblabs/ui";
import { formatElapsedSince, formatProjectDateTime } from "./shared/formatters";
import { useProjectsUiDictionary } from "./context";

function MetadataRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  const isEmpty = value === "-" || value === "–";
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="portal-meta inline-flex items-center gap-2 text-foreground/55">
        <Icon className="size-3 text-foreground/35" />
        {label}
      </span>
      <span
        className={`${MONO} portal-meta shrink-0 ${isEmpty ? "text-foreground/30" : "text-foreground/75"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function ProjectDetailMetadataStrip() {
  const dictionary = useProjectsUiDictionary();
  const project = useProjectDetailProject();

  const items: Array<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: CalendarClock, label: dictionary.detail.created, value: formatProjectDateTime(project.createdAt) },
    { icon: Hourglass, label: dictionary.detail.age, value: formatElapsedSince(project.createdAt) },
    { icon: Zap, label: dictionary.detail.activated, value: formatProjectDateTime(project.activatedAt) },
    { icon: History, label: dictionary.detail.updated, value: formatProjectDateTime(project.updatedAt) },
    ...(project.completedAt
      ? [{ icon: CheckCircle2, label: dictionary.detail.completed, value: formatProjectDateTime(project.completedAt) }]
      : []),
  ];

  return (
    <section className="dashboard-reveal flex justify-end border-t border-border-hairline-soft pt-3">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="portal-label inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-border-hairline-soft bg-transparent px-2.5 py-1.5 text-foreground/55 transition-colors hover:bg-[color:var(--muted)] hover:text-foreground"
          >
            <Info className="size-3" />
            {dictionary.detail.details}
            <ChevronDown className="size-3 opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-0">
          <div className="border-b border-border-hairline-soft px-3 py-2.5">
            <span className="portal-label text-foreground/45">{dictionary.detail.details}</span>
          </div>
          <div className="divide-y divide-border-hairline-soft px-3 py-1">
            {items.map((item) => (
              <MetadataRow key={item.label} icon={item.icon} label={item.label} value={item.value} />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </section>
  );
}
