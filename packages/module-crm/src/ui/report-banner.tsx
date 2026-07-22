import { ArrowUpRight, BarChart3 } from "lucide-react";

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
  dictionary?: CrmUiDictionary;
};

export function CrmReportBanner({ summary, href, dictionary = defaultCrmUiDictionary }: CrmReportBannerProps) {
  const metrics = [
    { label: dictionary.dashboard.last7Days, value: summary.newLast7Days },
    { label: dictionary.dashboard.last30Days, value: summary.newLast30Days },
    { label: dictionary.dashboard.last12Months, value: summary.newLastYear },
  ];

  return (
    <section>
      <a href={href} aria-label={dictionary.dashboard.reportAriaLabel} className="brand-panel group relative block overflow-hidden rounded-[var(--radius-panel)] p-6 text-primary-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--accent)_38%,transparent),transparent_70%)] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--accent)_60%,transparent),transparent)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 lg:flex-1">
            <p className="inline-flex items-center gap-2 text-ui-label text-current/65">
              <BarChart3 className="size-3.5 text-accent" aria-hidden />
              {dictionary.dashboard.reportEyebrow}
            </p>
            <h2 className="mt-4 text-ui-title text-current">{dictionary.dashboard.reportTitle}</h2>
            <p className="mt-3 max-w-[34rem] text-ui-body text-current/70">
              <span className="font-semibold text-accent">{summary.qualifiedLast30Days}</span>{" "}
              {summary.qualifiedLast30Days === 1 ? dictionary.dashboard.qualifiedSingular : dictionary.dashboard.qualifiedPlural}
              <span className="mx-1.5 opacity-40">·</span>
              <span className="font-semibold text-current">{summary.wonLast30Days}</span>{" "}
              {summary.wonLast30Days === 1 ? dictionary.dashboard.wonSingular : dictionary.dashboard.wonPlural} {dictionary.dashboard.inLast30Days}
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-ui-meta font-semibold text-accent-foreground transition-[filter] group-hover:brightness-105">
              {dictionary.dashboard.openReport}
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </span>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="flex min-w-[104px] flex-col justify-center rounded-[var(--radius-card)] border border-current/20 bg-current/10 px-4 py-4">
                <span className="font-display text-[40px] font-black leading-[0.9] tracking-[-0.05em] text-current">{metric.value}</span>
                <span className="mt-2 text-ui-micro uppercase tracking-[0.1em] text-current/65">{metric.label}</span>
              </div>
            ))}
          </div>
        </div>
      </a>
    </section>
  );
}
