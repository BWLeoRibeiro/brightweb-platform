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
import { formatNaturalDisplayName } from "./natural-display-name";

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

function getCalendarDayDifference(iso: string | null) {
  if (!iso) return null;
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
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
  const remainingTasks = Math.max(0, project.taskStats.total - project.taskStats.done);
  const targetDayDifference = getCalendarDayDifference(project.targetDate);
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
  const detail = (() => {
    switch (project.attentionReason) {
      case "overdue":
        return targetDayDifference === -1
          ? dictionary.dashboard.details.overdueYesterday
          : dictionary.dashboard.details.overdueDaysAgo(Math.max(1, Math.abs(targetDayDifference ?? 1)));
      case "at_risk":
        return dictionary.dashboard.details.atRisk(targetDayDifference, remainingTasks);
      case "blocked_tasks":
        return dictionary.dashboard.details.blockedTasks(remainingTasks);
      case "without_owner":
        return dictionary.dashboard.details.withoutOwner(targetDayDifference);
      case "due_soon":
        return dictionary.dashboard.details.dueSoon(targetDayDifference, remainingTasks);
    }
  })();

  return (
    <Link
      href={navigation.detailHref(project.id)}
      prefetch={false}
      className="project-attention-row group focus-visible:z-[2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ring)]"
      style={{
        "--project-attention-tone": attention.tone,
        "--project-attention-surface": attention.surface,
      } as CSSProperties}
    >
      <span
        aria-hidden
        className="project-attention-rank"
      >
        {String(rank).padStart(2, "0")}
        <span />
      </span>

      <div className="project-attention-summary">
        <p className="project-attention-company">{formatNaturalDisplayName(project.organizationName)}</p>
        <h3 className="project-attention-title">{project.name}</h3>
        <p className="project-attention-reason">
          <span aria-hidden className="project-attention-reason-dot" />
          <span><strong>{reason}</strong> {detail}</span>
        </p>
      </div>

      <div className="project-attention-meta">
        <div className="project-attention-badges">
          <span className="project-attention-status">
            <span aria-hidden style={{ background: status.dot }} />
            {status.label}
          </span>
          <ProjectPill
            size="normal"
            dotClassName="project-attention-pill-dot"
            className="border-[color:var(--tint-soft-border)] bg-[color:var(--tint-soft-bg)] font-bold text-[color:var(--tint)]"
            style={{ "--tint": riskMeta?.var ?? attention.tone } as CSSProperties}
          >
            {attentionLabel}
          </ProjectPill>
        </div>

        <div className="project-attention-progress">
          <span className="project-attention-owner">
            <ProjectOwnerAvatar className="project-attention-avatar" label={project.ownerLabel} size="sm" roleColor="manager" />
            <span className="truncate">{project.ownerLabel ?? dictionary.detail.noOwnerLowercase}</span>
          </span>
          <strong className="project-attention-progress-value">{progress}%</strong>
          <span className="project-attention-track">
            <span className="block h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${progress}%` }} />
          </span>
          <span className="project-attention-date">
            <CalendarDays aria-hidden className="project-attention-date-icon opacity-70" strokeWidth={1.75} />
            <span>{formatShortDate(project.targetDate)}</span>
          </span>
        </div>
      </div>

      <span aria-hidden className="project-attention-arrow">
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
