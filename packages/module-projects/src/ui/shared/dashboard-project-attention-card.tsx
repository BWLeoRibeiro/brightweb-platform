"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import type { CSSProperties } from "react";
import type { DashboardProjectAttentionItem } from "@brightweblabs/app-shell";
import { useProjectsNavigation, useProjectsUiDictionary } from "../context";
import { getCompletionPercent } from "./project-progress";
import { ProjectOwnerAvatar } from "./project-owner-avatar";
import { ProjectPill } from "./project-pill";
import { PROJECT_RISK_META, resolveProjectRisk } from "./project-risk";
import { monoTabularClassName as MONO } from "./typography";

const ATTENTION_META = {
  overdue: {
    tone: "var(--project-risk-overdue)",
    surface: "var(--project-item-off-track-bg, var(--card))",
  },
  at_risk: {
    tone: "var(--project-risk-at-risk)",
    surface: "var(--project-item-at-risk-bg, var(--card))",
  },
  blocked_tasks: {
    tone: "var(--project-state-blocked)",
    surface: "var(--project-item-at-risk-bg, var(--card))",
  },
  without_owner: {
    tone: "var(--project-health-on-track)",
    surface: "var(--project-item-on-track-bg, var(--card))",
  },
  due_soon: {
    tone: "var(--accent)",
    surface: "var(--project-item-bg, var(--card))",
  },
} as const;

function formatShortDate(iso: string | null) {
  if (!iso) return "–";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(date);
}

export function DashboardProjectAttentionCard({
  project,
  rank,
}: {
  project: DashboardProjectAttentionItem;
  rank: number;
}) {
  const navigation = useProjectsNavigation();
  const dictionary = useProjectsUiDictionary();
  const statusMeta: Record<DashboardProjectAttentionItem["status"], { label: string; dot: string }> = {
    planned: { label: dictionary.status.planned, dot: "var(--project-state-planned)" },
    active: { label: dictionary.status.active, dot: "var(--project-state-active)" },
    blocked: { label: dictionary.status.blocked, dot: "var(--project-state-blocked)" },
    completed: { label: dictionary.status.completed, dot: "var(--project-state-completed)" },
    canceled: { label: dictionary.status.canceled, dot: "var(--project-state-canceled)" },
  };
  const status = statusMeta[project.status] ?? statusMeta.active;
  const attention = ATTENTION_META[project.attentionReason];
  const risk = resolveProjectRisk(project);
  const riskMeta = risk ? PROJECT_RISK_META[risk] : null;
  const progress = getCompletionPercent(project.taskStats.done, project.taskStats.total);
  const reason = (() => {
    switch (project.attentionReason) {
      case "overdue": return dictionary.dashboard.reasons.overdue;
      case "at_risk": return dictionary.dashboard.reasons.atRisk;
      case "blocked_tasks": return dictionary.dashboard.reasons.blockedTasks(project.taskStats.blocked);
      case "without_owner": return dictionary.dashboard.reasons.withoutOwner;
      case "due_soon": return dictionary.dashboard.reasons.dueSoon;
    }
  })();
  const attentionLabel = (() => {
    switch (project.attentionReason) {
      case "overdue": return dictionary.dashboard.badges.overdue;
      case "at_risk": return dictionary.dashboard.badges.atRisk;
      case "blocked_tasks": return dictionary.dashboard.badges.blockedTasks;
      case "without_owner": return dictionary.dashboard.badges.withoutOwner;
      case "due_soon": return dictionary.dashboard.badges.dueSoon;
    }
  })();

  return (
    <Link
      href={navigation.detailHref(project.id)}
      prefetch={false}
      className="group relative grid min-h-[8rem] grid-cols-[2rem_minmax(0,1fr)_1.75rem] items-center gap-3 overflow-hidden border-b border-[color:var(--border)] px-4 py-4 transition hover:z-[1] hover:-translate-y-px hover:shadow-[0_12px_30px_var(--project-ui-color-72)] focus-visible:z-[2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ring)] last:border-b-0 lg:grid-cols-[2rem_minmax(0,1.2fr)_minmax(12rem,0.8fr)_1.75rem]"
      style={{ background: attention.surface } as CSSProperties}
    >
      <span
        aria-hidden
        className="text-data-sm self-start pt-0.5 font-black tracking-[var(--type-tracking-080)]"
        style={{ color: attention.tone }}
      >
        {String(rank).padStart(2, "0")}
        <span className="mt-2 block h-0.5 w-3 rounded-full" style={{ background: attention.tone }} />
      </span>

      <div className="min-w-0">
        <p className="truncate text-label text-[color:var(--muted-foreground)]">{project.organizationName}</p>
        <h3 className="mt-0.5 truncate text-title font-bold text-[color:var(--foreground)]">{project.name}</h3>
        <p className="mt-2 flex items-start gap-2 text-meta leading-[var(--type-leading-140)] text-[color:var(--muted-foreground)]">
          <span aria-hidden className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: attention.tone }} />
          <span><strong className="text-[color:var(--foreground)]">{reason}</strong></span>
        </p>
      </div>

      <div className="col-span-2 col-start-2 min-w-0 pt-1 lg:col-span-1 lg:col-start-auto lg:pt-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-meta font-semibold text-[color:var(--foreground)]">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: status.dot }} />
            {status.label}
          </span>
          <ProjectPill
            size="small"
            className="border-[color:var(--tint-soft-border)] bg-[color:var(--tint-soft-bg)] font-bold text-[color:var(--tint)]"
            style={{ "--tint": riskMeta?.var ?? attention.tone } as CSSProperties}
          >
            {riskMeta?.label ?? attentionLabel}
          </ProjectPill>
        </div>

        <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex min-w-0 items-center gap-2 text-meta text-[color:var(--muted-foreground)]">
            <ProjectOwnerAvatar label={project.ownerLabel} size="sm" roleColor="manager" />
            <span className="truncate">{project.ownerLabel ?? dictionary.detail.noOwnerLowercase}</span>
          </span>
          <strong className={`${MONO} text-meta text-[color:var(--foreground)]`}>{progress}%</strong>
          <span className="col-span-2 h-1 overflow-hidden rounded-full bg-[color:var(--project-ui-color-71)]">
            <span className="block h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${progress}%` }} />
          </span>
          <span className="col-span-2 inline-flex justify-end gap-1.5 text-meta font-bold" style={{ color: attention.tone }}>
            <CalendarDays className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} />
            <span className={MONO}>{formatShortDate(project.targetDate)}</span>
          </span>
        </div>
      </div>

      <ArrowUpRight className="col-start-3 row-start-1 h-3.5 w-3.5 self-start justify-self-end text-[color:var(--muted-foreground)] opacity-0 transition group-hover:text-[color:var(--accent)] group-hover:opacity-100 group-focus-visible:opacity-100 lg:col-start-4" />
    </Link>
  );
}
