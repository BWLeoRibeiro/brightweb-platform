"use client";

import { RhythmPeriodRow } from "./dashboard-kpis";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, CircleDot, Plus, Users } from "lucide-react";
import { Card, Skeleton } from "@brightweblabs/ui";
import type { DashboardCrmData, DashboardCrmRecentContact } from "./types";
import { type DashboardDictionary } from "./dictionary";
import { DashboardActionLink as PortalActionLink, DashboardCountPill, DashboardEmptyState, DashboardSectionHeading as PortalSectionHeading, QuickCreateAction, dashboardCardTitleClassName as CARD_TITLE, dashboardMonoTabularClassName as MONO } from "./primitives";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@brightweblabs/ui";
import { useDashboardDictionary } from "./dashboard-context";
import { initialsOf, formatDayMonth, formatShortDate } from "./dashboard-formatters";

type TagMeta = { label: string; color: string; strong: string };

function Tag({ meta }: { meta: TagMeta }) {
  return (
    <span
      className="tint-soft inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-micro font-bold"
      style={{ ["--tint" as string]: meta.color, ["--tint-strong" as string]: meta.strong }}
    >
      <span className="dashboard-status-dot h-1.5 w-1.5 rounded-full" />
      {meta.label}
    </span>
  );
}

function crmStatusMeta(status: string, dictionary: DashboardDictionary): TagMeta {
  const labels = dictionary.crm.statuses;
  const values: Record<string, TagMeta> = {
    lead: { label: labels.lead, color: "var(--dashboard-status-lead)", strong: "var(--semantic-info-strong)" },
    qualified: { label: labels.qualified, color: "var(--dashboard-status-qualified)", strong: "var(--semantic-warning-strong)" },
    proposal: { label: labels.proposal, color: "var(--dashboard-status-proposal)", strong: "var(--foreground)" },
    won: { label: labels.won, color: "var(--dashboard-status-won)", strong: "var(--semantic-success-strong)" },
    lost: { label: labels.lost, color: "var(--dashboard-status-lost)", strong: "var(--semantic-neutral-strong)" },
  };
  return values[status] ?? values.lead!;
}

function formatMonthShort(isoMonth: string) {
  const d = new Date(`${isoMonth}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoMonth;
  return new Intl.DateTimeFormat("pt-PT", { month: "short", timeZone: "UTC" }).format(d).replace(".", "");
}

function formatMonthLong(isoMonth: string) {
  const d = new Date(`${isoMonth}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoMonth;
  return new Intl.DateTimeFormat("pt-PT", { month: "long", timeZone: "UTC" }).format(d);
}

function RhythmSparkline({ series, ariaLabel }: { series: { month: string; count: number }[]; ariaLabel: string }) {
  const dictionary = useDashboardDictionary();
  const max = Math.max(1, ...series.map((p) => p.count));
  const w = 320;
  const h = 84;
  const chartTop = 6;
  const chartBottom = h - 4;
  const step = series.length > 1 ? w / (series.length - 1) : w;
  const coordinates = series.map((p, i) => ({
    x: i * step,
    y: chartBottom - (p.count / max) * (chartBottom - chartTop),
  }));
  const points = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = coordinates.length > 0
    ? `M 0 ${chartBottom} L ${points.replaceAll(",", " ")} L ${w} ${chartBottom} Z`
    : "";
  const current = coordinates[coordinates.length - 1];
  const visibleMonths = series
    .map((point, index) => ({ point, index, x: coordinates[index]!.x }))
    .filter(({ index }) => index % 2 === 0 || index === series.length - 1);

  return (
    <div className="mt-7 min-w-0" role="group" aria-label={ariaLabel}>
      <TooltipProvider delayDuration={80}>
        <div className="relative h-[5.25rem] w-full">
          <svg aria-hidden viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="dashboard-rhythm-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--dashboard-rhythm-accent)" stopOpacity="0.34" />
                <stop offset="100%" stopColor="var(--dashboard-rhythm-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#dashboard-rhythm-fill)" />
            <polyline
              points={points}
              fill="none"
              stroke="var(--dashboard-rhythm-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {current ? (
              <circle
                cx={current.x}
                cy={current.y}
                r="4"
                fill="var(--dashboard-rhythm-accent)"
                stroke="var(--project-hero-surface-raised)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
          {coordinates.map(({ x, y }, index) => {
            const point = series[index]!;
            const countLabel = point.count === 1 ? dictionary.clients.one : dictionary.clients.many;
            const tooltipLabel = `${formatMonthLong(point.month)} · ${point.count} ${countLabel}`;
            return (
              <Tooltip key={point.month}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={tooltipLabel}
                    className="group absolute z-10 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--dashboard-rhythm-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--project-hero-surface-raised)]"
                    style={{ left: `${(x / w) * 100}%`, top: `${(y / h) * 100}%` }}
                  >
                    <span className="size-2 rounded-full bg-[color:var(--dashboard-rhythm-accent)] opacity-0 shadow-[0_0_0_2px_var(--project-hero-surface-raised)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <span className={MONO}>{tooltipLabel}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
      <div className={`${MONO} relative mt-2 h-3 text-micro text-[color:var(--project-hero-subtle)]`}>
        {visibleMonths.map(({ point, index, x }) => (
          <span
            key={point.month}
            data-rhythm-month-label={point.month}
            className="absolute top-0 whitespace-nowrap"
            style={{
              left: `${(x / w) * 100}%`,
              transform: index === 0 ? "none" : index === series.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {formatMonthShort(point.month)}
          </span>
        ))}
      </div>
    </div>
  );
}

function RhythmCard({ crm, isLoading }: { crm: DashboardCrmData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const kpis = crm?.kpis;
  const series = crm?.crm.monthlyNewContacts ?? [];
  const monthValue = series.length > 0 ? series[series.length - 1]!.count : kpis?.crmNewLast30Days ?? 0;
  const previousMonth = series.length > 1 ? series[series.length - 2]!.count : null;
  const delta = previousMonth === null ? null : monthValue - previousMonth;
  const rhythmStatus = delta === null
    ? dictionary.clients.rhythmNoHistory ?? "Sem histórico"
    : delta > 0
      ? dictionary.clients.rhythmGrowing ?? "A crescer"
      : delta < 0
        ? dictionary.clients.rhythmDeclining ?? "A diminuir"
        : dictionary.clients.rhythmStable ?? "Estável";
  const currentContactLabel = monthValue === 1 ? dictionary.clients.one : dictionary.clients.many;
  const previousContactLabel = previousMonth === 1 ? dictionary.clients.one : dictionary.clients.many;
  const rhythmSummary = `${dictionary.clients.thisMonth ?? "Este mês"}: ${monthValue} ${currentContactLabel}; ${dictionary.clients.vsPreviousMonth ?? "vs. mês anterior"}: ${previousMonth ?? 0} ${previousContactLabel}.`;
  return (
    <aside className="brand-panel dashboard-rhythm-card overflow-hidden rounded-[var(--radius-card)] p-6 text-[color:var(--project-hero-foreground)]" aria-labelledby="dashboard-client-rhythm-title">
      <span
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[color:var(--dashboard-milestone-glow)] blur-3xl opacity-100 dark:opacity-40"
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center rounded-full bg-[color:var(--dashboard-milestone-icon)] text-[color:var(--dashboard-rhythm-accent)]"
          >
            <CircleDot aria-hidden className="size-3.5" />
          </span>
          <h2 id="dashboard-client-rhythm-title" className="truncate text-title font-semibold tracking-tight">{dictionary.clients.rhythmTitle ?? "Resumo"}</h2>
        </div>
        <span className="shrink-0 rounded-full border border-[color:var(--project-hero-border)] px-2.5 py-1 text-micro font-semibold text-[color:var(--project-hero-muted)]">
          {rhythmStatus}
        </span>
      </div>

      <div className="relative mt-7 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-kpi-lg leading-none text-[color:var(--project-hero-foreground)]">
          {isLoading ? "–" : monthValue}
        </span>
        <span className="text-body font-semibold text-[color:var(--project-hero-muted)]">
          {monthValue === 1 ? dictionary.clients.newOne : dictionary.clients.newMany}
        </span>
      </div>
      {delta !== null && !isLoading ? (
        <span
          className="relative mt-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-micro font-semibold"
          style={delta > 0
            ? { borderColor: "var(--dashboard-rhythm-trend-border, var(--project-hero-border))", color: "var(--dashboard-rhythm-accent)" }
            : { borderColor: "var(--project-hero-border)", color: "var(--project-hero-muted)" }}
        >
          {delta > 0 ? `↑ +${delta}` : delta < 0 ? `↓ ${delta}` : "– 0"} {dictionary.clients.vsPreviousMonth ?? "vs. mês anterior"}
        </span>
      ) : null}

      {series.length > 0 ? <RhythmSparkline series={series} ariaLabel={rhythmSummary} /> : null}

      <div className="relative mt-6 flex flex-col gap-3 border-t border-[color:var(--project-hero-border)] pt-5">
        <RhythmPeriodRow label={dictionary.clients.lastSevenDays} value={kpis?.crmNewLast7Days ?? 0} isLoading={isLoading} />
        <RhythmPeriodRow label={dictionary.clients.lastThirtyDays} value={kpis?.crmNewLast30Days ?? 0} isLoading={isLoading} />
        <RhythmPeriodRow label={dictionary.clients.lastTwelveMonths} value={kpis?.crmNewLastYear ?? 0} isLoading={isLoading} />
      </div>
    </aside>
  );
}

function AddContactCard() {
  const dictionary = useDashboardDictionary();
  return (
    <Link
      href="/crm?create=contact"
      prefetch={false}
      className="flex min-h-[9.25rem] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[color:var(--border)] p-4 text-meta font-semibold text-[color:var(--muted-foreground)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-current">
        <Plus className="h-4 w-4" strokeWidth={2} />
      </span>
      {dictionary.clients.addNew ?? "Novo contacto"}
    </Link>
  );
}

function ContactCard({ c }: { c: DashboardCrmRecentContact }) {
  const dictionary = useDashboardDictionary();
  const meta = crmStatusMeta(c.status, dictionary);
  return (
    <Card asChild variant="interactive" density="compact">
      <Link href={`/crm?contact=${encodeURIComponent(c.id)}`} prefetch={false} className="group relative w-full p-5">
        <span
          aria-hidden
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--foreground-accent-link)] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--dashboard-client-avatar)] text-meta font-bold text-[color:var(--role-client-strong)]"
          aria-hidden
        >
          {initialsOf(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold text-[color:var(--foreground)]">{c.name}</p>
          <p className="truncate text-meta text-[color:var(--muted-foreground)]">{c.company ?? "—"}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border)] pt-3 text-meta text-[color:var(--muted-foreground)]">
        <Tag meta={meta} />
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays aria-hidden className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} />
          <span>{c.createdAt ? (dictionary.clients.addedOn ?? dictionary.clients.lastChange) : dictionary.clients.lastChange}</span>
          <span className={`${MONO} font-semibold text-[color:var(--foreground)]`}>
            {c.createdAt ? formatDayMonth(c.createdAt) : formatShortDate(c.lastChangedAt)}
          </span>
        </span>
      </div>
      </Link>
    </Card>
  );
}

export function ClientsView({ crm, isLoading }: { crm: DashboardCrmData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const contacts = crm?.crm.recentContacts ?? [];
  const tilesLoading = isLoading && !crm;

  return (
    <div className="space-y-6">
      <PortalSectionHeading
        title={dictionary.clients.title}
        subtitle={dictionary.clients.subtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PortalActionLink href="/crm" prefetch={false}>
              {dictionary.clients.viewAll}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </PortalActionLink>
            <QuickCreateAction
              href="/crm?create=contact"
              label={dictionary.clients.addNew ?? "Novo contacto"}
            />
          </div>
        }
      />

      <div className="dashboard-clients-grid">
        <Card asChild>
        <section className="min-w-0 overflow-hidden" aria-labelledby="dashboard-recent-contacts">
          <header className="flex min-h-16 items-center justify-between gap-4 border-b border-[color:var(--border)] px-5 py-4">
            <h3 id="dashboard-recent-contacts" className={CARD_TITLE}>{dictionary.clients.recentTitle}</h3>
            {tilesLoading ? <Skeleton className="h-7 w-24 rounded-full" /> : (
              <DashboardCountPill
                count={contacts.length}
                label={contacts.length === 1 ? dictionary.clients.one : dictionary.clients.many}
                tone="neutral"
              />
            )}
          </header>
        {isLoading && contacts.length === 0 ? (
          <div className="dashboard-contacts-list p-5">
            {[0, 1, 2, 3].map((i) => (
              <Card
              key={i}
              density="compact"
              className="h-[9.25rem] w-full justify-between p-5"
            >
              <div className="flex items-center gap-3">
                <Skeleton rounded="50%" className="h-10 w-10 shrink-0" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton rounded="999px" className="h-[0.6rem] w-[60%]" />
                  <Skeleton rounded="999px" className="h-[0.5rem] w-[80%]" />
                </div>
              </div>
              <Skeleton rounded="999px" className="h-[0.5rem] w-[45%]" />
            </Card>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="dashboard-contacts-list flex-1 p-5">
            <DashboardEmptyState
              className="min-h-64 min-[1081px]:col-span-2"
              icon={(
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--muted)] text-[color:var(--muted-foreground)]">
                  <Users aria-hidden className="h-5 w-5" />
                </span>
              )}
              title={dictionary.clients.recentTitle}
              description={dictionary.clients.noRecent}
            >
              <AddContactCard />
            </DashboardEmptyState>
          </div>
        ) : (
          <div className="dashboard-contacts-list p-5">
            {contacts.map((c) => (
              <ContactCard key={c.id} c={c} />
            ))}
            <AddContactCard />
          </div>
        )}
        </section>
        </Card>
        <RhythmCard crm={crm} isLoading={tilesLoading} />
      </div>
    </div>
  );
}
