import { ArrowUpRight, BarChart3 } from "lucide-react";
import { Skeleton } from "@brightweblabs/ui";

import { defaultCrmUiDictionary } from "./dictionary";
import type { CrmUiDictionary } from "./types";

export type CrmReportBannerSummary = {
  qualifiedLast30Days: number;
  wonLast30Days: number;
  newLast7Days: number;
  newLast30Days: number;
  newLastYear: number;
};

export type CrmReportBannerProps = {
  summary: CrmReportBannerSummary;
  href: string;
  loading?: boolean;
  unavailable?: boolean;
  dictionary?: CrmUiDictionary;
};

export function CrmReportBanner({ summary, href, loading = false, unavailable = false, dictionary = defaultCrmUiDictionary }: CrmReportBannerProps) {
  const metrics = [
    { label: dictionary.dashboard.last7Days, value: summary.newLast7Days },
    { label: dictionary.dashboard.last30Days, value: summary.newLast30Days },
    { label: dictionary.dashboard.last12Months, value: summary.newLastYear },
  ];

  return (
    <section aria-busy={loading}>
      {loading || unavailable ? (
        <div className="brand-panel flex min-h-[var(--crm-report-banner-min-height,16rem)] items-center rounded-[var(--radius-panel)] p-6 md:p-7">
          {loading ? (
            <div className="grid w-full gap-4" aria-label={dictionary.report.loading}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-72 max-w-full" />
              <Skeleton className="h-5 w-96 max-w-full" />
              <div className="grid grid-cols-3 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            </div>
          ) : <p role="alert" className="text-body text-destructive">{dictionary.dashboard.loadError}</p>}
        </div>
      ) : (
      <a href={href} aria-label={dictionary.dashboard.reportAriaLabel} className="brand-panel group relative block overflow-hidden rounded-[var(--radius-panel)] p-6 text-[color:var(--project-hero-foreground)] outline-none transition focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] md:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[image:var(--report-hero-glow)] blur-3xl opacity-100 transition-opacity duration-300 group-hover:opacity-100 dark:opacity-40 dark:group-hover:opacity-60" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[image:var(--report-hero-rule)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 lg:flex-1">
            <p className="inline-flex items-center gap-2 text-label font-semibold uppercase tracking-[var(--type-tracking-160)]" style={{ color: "var(--project-hero-muted)" }}>
              <BarChart3 className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} aria-hidden />
              {dictionary.dashboard.reportEyebrow}
            </p>
            <h2 className="font-display mt-4 text-heading-1 text-[length:var(--text-ui-report-title)] font-extrabold leading-[var(--type-leading-104)] tracking-[var(--type-tracking-n035)] md:text-heading-1 text-[length:var(--text-ui-report-title-lg)]" style={{ color: "var(--project-hero-foreground)" }}>{dictionary.dashboard.reportTitle}</h2>
            <p className="mt-3 max-w-[var(--crm-report-copy-max-width)] text-title" style={{ color: "var(--project-hero-muted)" }}>
              <span className="font-semibold" style={{ color: "var(--accent)" }}>{summary.qualifiedLast30Days}</span>{" "}
              {summary.qualifiedLast30Days === 1 ? dictionary.dashboard.qualifiedSingular : dictionary.dashboard.qualifiedPlural}
              <span className="mx-1.5 opacity-40">·</span>
              <span className="font-semibold" style={{ color: "var(--project-hero-foreground)" }}>{summary.wonLast30Days}</span>{" "}
              {summary.wonLast30Days === 1 ? dictionary.dashboard.wonSingular : dictionary.dashboard.wonPlural} {dictionary.dashboard.inLast30Days}
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-body text-[length:var(--text-ui-action)] font-semibold transition-[filter] group-hover:brightness-[1.05]" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
              {dictionary.dashboard.openReport}
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </span>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="flex min-w-[var(--crm-report-metric-min-width)] flex-col justify-center rounded-[var(--radius-card)] border px-4 py-4" style={{ borderColor: "var(--project-hero-border)", background: "var(--project-hero-surface-raised)" }}>
                <span className="text-kpi text-[length:var(--text-ui-report-metric)] font-black leading-[var(--type-leading-090)] tracking-[var(--type-tracking-n050)]" style={{ color: "var(--project-hero-foreground)" }}>{metric.value}</span>
                <span className="mt-2 text-label uppercase tracking-[var(--type-tracking-100)]" style={{ color: "var(--project-hero-muted)" }}>{metric.label}</span>
              </div>
            ))}
          </div>
        </div>
      </a>
      )}
    </section>
  );
}
