"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, BarChart3, Building2, CircleDashed, Sparkles, TrendingUp, UserRound } from "lucide-react";
import { Badge, Button, SectionHeading, Skeleton, SurfaceCard } from "@brightweblabs/ui";

import type { CrmReportData } from "../data";
import { createCrmUiClient } from "./client";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import type { CrmReportSlots, CrmStageConfig, CrmUiClient, CrmUiDictionary } from "./types";

export const CRM_SURFACE_CLASS_NAME = "rounded-[var(--radius-card)] border border-hairline bg-card shadow-none";

type DistributionItem = { key: string; label: string; count: number; share: number; badge?: ReactNode; token?: string };

function HeroMetric({ label, value, metricLabel }: { label: string; value: string | number; metricLabel: string }) {
  return (
    <div className="flex min-w-[9rem] flex-1 flex-col justify-center rounded-[var(--radius-card)] border border-hairline bg-card/10 px-4 py-3">
      <p className="text-ui-label text-current/65">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5"><span className="font-mono text-3xl font-semibold tabular-nums">{value}</span><span className="text-ui-meta text-current/65">{metricLabel}</span></p>
    </div>
  );
}

function DistributionList({ items, emptyLabel }: { items: DistributionItem[]; emptyLabel: string }) {
  if (items.length === 0) return <p className="text-ui-meta text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="grid gap-2.5">
      {items.map((item) => (
        <div key={item.key} className="rounded-[var(--radius-card)] border border-hairline bg-elevate-1 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">{item.badge}<p className="truncate text-ui-body font-semibold text-foreground">{item.label}</p></div>
            <div className="text-right"><p className="text-ui-body font-semibold text-foreground">{item.count}</p><p className="text-ui-meta text-muted-foreground">{item.share}%</p></div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevate-3"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(item.share, item.count > 0 ? 6 : 0)}%`, backgroundColor: item.token ? `var(${item.token})` : undefined }} /></div>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-[var(--radius-card)] border border-hairline bg-elevate-1 p-3"><p className="text-ui-label text-muted-foreground">{label}</p><p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p></div>;
}

export type CrmReportProps = {
  data: CrmReportData;
  dictionary?: CrmUiDictionary;
  stages?: CrmStageConfig[];
  backHref?: string;
  slots?: CrmReportSlots;
};

export function CrmReport({ data, dictionary = defaultCrmUiDictionary, stages, backHref = "/crm", slots }: CrmReportProps) {
  const resolvedStages = resolveCrmStages(dictionary, stages);
  const stageMap = new Map(resolvedStages.map((stage) => [stage.value, stage]));
  return (
    <div className="flex w-full flex-col gap-6">
      <header className="brand-panel relative overflow-hidden rounded-[var(--radius-panel)] p-6 text-primary-foreground md:p-8">
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 lg:flex-1">
            <p className="inline-flex items-center gap-2 text-ui-label text-current/65"><BarChart3 className="size-3.5" aria-hidden />{dictionary.report.eyebrow}</p>
            <h1 className="mt-4 text-ui-title">{dictionary.report.titlePrefix} <span className="text-accent">{dictionary.report.titleAccent}</span></h1>
            <p className="mt-3 text-ui-body text-current/70"><span className="font-semibold text-current">{data.summary.qualifiedContacts}</span> {dictionary.report.qualified}<span className="mx-1.5 opacity-40">·</span><span className="font-semibold text-current">{data.summary.wonContacts}</span> {dictionary.report.won}<span className="mx-1.5 opacity-40">·</span><span className="font-semibold text-current">{data.summary.lostContacts}</span> {dictionary.report.lost}</p>
            <p className="mt-2 text-ui-meta text-current/65">{dictionary.report.updated} {new Intl.DateTimeFormat(dictionary.locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generatedAt))}</p>
            <Button href={backHref} variant="outline" size="sm" className="mt-5 border-current/25 bg-current/10 text-current hover:bg-current/15"><ArrowLeft className="size-3.5" aria-hidden />{dictionary.report.back}</Button>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3 lg:flex-nowrap">
            <HeroMetric label={dictionary.report.totalContacts} value={data.summary.totalContacts} metricLabel={dictionary.report.portfolio} />
            <HeroMetric label={dictionary.report.qualification} value={data.summary.qualificationRate} metricLabel={dictionary.report.baseShare} />
            <HeroMetric label={dictionary.report.winRate} value={data.summary.winRate} metricLabel={dictionary.report.closedShare} />
          </div>
        </div>
      </header>
      {slots?.afterHero}
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SurfaceCard className="p-5"><SectionHeading icon={CircleDashed} title={dictionary.report.statusTitle} subtitle={dictionary.report.statusSubtitle} /><div className="mt-4"><DistributionList items={data.byStatus.map((item) => { const stage = stageMap.get(item.status as CrmStageConfig["value"]); return { key: item.status, label: stage?.label ?? item.label, count: item.count, share: item.share, token: stage?.token, badge: stage ? <Badge variant="outline" style={{ color: `var(${stage.token}-strong)` }}>{stage.label}</Badge> : undefined }; })} emptyLabel={dictionary.report.noContacts} /></div></SurfaceCard>
        <SurfaceCard className="p-5"><SectionHeading icon={TrendingUp} title={dictionary.report.closeTitle} subtitle={dictionary.report.closeSubtitle} /><div className="mt-4 grid gap-2.5"><MetricCard label={dictionary.report.wonContacts} value={data.summary.wonContacts} /><MetricCard label={dictionary.report.lostContacts} value={data.summary.lostContacts} /><MetricCard label={dictionary.report.closedDeals} value={data.summary.closedDeals} /></div></SurfaceCard>
      </section>
      {slots?.beforeDistributions}
      <section className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard className="p-5"><SectionHeading icon={Sparkles} title={dictionary.report.sourceTitle} subtitle={dictionary.report.sourceSubtitle} /><div className="mt-4"><DistributionList items={data.bySource.map((item) => ({ key: item.source, label: item.label, count: item.count, share: item.share }))} emptyLabel={dictionary.report.noSources} /></div></SurfaceCard>
        <SurfaceCard className="p-5"><SectionHeading icon={UserRound} title={dictionary.report.ownerTitle} subtitle={dictionary.report.ownerSubtitle} /><div className="mt-4"><DistributionList items={data.byOwner.map((item, index) => ({ key: item.ownerId ?? `unassigned-${index}`, label: item.label, count: item.count, share: item.share }))} emptyLabel={dictionary.report.noOwners} /></div></SurfaceCard>
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard className="p-5"><SectionHeading icon={Building2} title={dictionary.report.organizationTitle} subtitle={dictionary.report.organizationSubtitle} /><div className="mt-4 grid gap-3"><div className="grid gap-2.5 md:grid-cols-3"><MetricCard label={dictionary.report.totalOrganizations} value={data.organizationCoverage.totalOrganizations} /><MetricCard label={dictionary.report.withContacts} value={data.organizationCoverage.organizationsWithContacts} /><MetricCard label={dictionary.report.coverage} value={`${data.organizationCoverage.share}%`} /></div><div className="rounded-[var(--radius-card)] border border-dashed border-hairline bg-elevate-1 px-4 py-3.5"><p className="text-ui-body font-semibold text-foreground">{dictionary.report.withoutContacts(data.organizationCoverage.organizationsWithoutContacts)}</p><p className="mt-1 text-ui-meta text-muted-foreground">{dictionary.report.coverageHint}</p></div></div></SurfaceCard>
        <SurfaceCard className="p-5"><SectionHeading icon={BarChart3} title={dictionary.report.topOrganizations} subtitle={dictionary.report.topOrganizationsSubtitle} /><div className="mt-4 grid gap-2.5">{data.organizationCoverage.topOrganizations.length === 0 ? <p className="text-ui-meta text-muted-foreground">{dictionary.report.noOrganizations}</p> : data.organizationCoverage.topOrganizations.map((organization) => <div key={organization.organizationId} className="rounded-[var(--radius-card)] border border-hairline bg-elevate-1 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-ui-body font-semibold text-foreground">{organization.name}</p><p className="truncate text-ui-meta text-muted-foreground">{organization.industry ?? dictionary.report.noIndustry}</p></div><Badge variant="outline">{organization.contactCount}</Badge></div>{organization.websiteUrl ? <a href={organization.websiteUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 text-ui-meta text-muted-foreground hover:text-foreground"><span className="truncate">{organization.websiteUrl}</span><ArrowUpRight className="size-3" aria-hidden /></a> : <p className="mt-2 text-ui-meta text-muted-foreground">{dictionary.report.noWebsite}</p>}</div>)}</div></SurfaceCard>
      </section>
      {slots?.afterDistributions}
    </div>
  );
}

export type CrmReportPageProps = Omit<CrmReportProps, "data"> & { client?: CrmUiClient; initialData?: CrmReportData };

export function CrmReportPage({ client: providedClient, initialData, dictionary = defaultCrmUiDictionary, ...props }: CrmReportPageProps) {
  const client = useMemo(() => providedClient ?? createCrmUiClient(), [providedClient]);
  const [data, setData] = useState(initialData);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (initialData) return;
    void client.getReport().then(setData).catch(() => setFailed(true));
  }, [client, initialData]);
  if (failed) return <p role="alert" className="rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-ui-body text-destructive">{dictionary.report.loadError}</p>;
  if (!data) return <SurfaceCard className="grid gap-4 p-6" aria-label={dictionary.report.loading}>{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}</SurfaceCard>;
  return <CrmReport {...props} dictionary={dictionary} data={data} />;
}
