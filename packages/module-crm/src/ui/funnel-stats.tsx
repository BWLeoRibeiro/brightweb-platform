"use client";

import { KpiBreakdownBar, Skeleton, StatTile, StatValue } from "@brightweblabs/ui";

import type { CrmContactStatusStats } from "../data";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import type { CrmStageConfig, CrmUiDictionary } from "./types";

export type CrmFunnelStatsProps = {
  stats?: CrmContactStatusStats;
  loading?: boolean;
  dictionary?: CrmUiDictionary;
  stages?: CrmStageConfig[];
};

export function CrmFunnelStats({
  stats,
  loading = false,
  dictionary = defaultCrmUiDictionary,
  stages,
}: CrmFunnelStatsProps) {
  const resolvedStages = resolveCrmStages(dictionary, stages);
  const tiles = [
    { value: "total", label: dictionary.stats.total, token: undefined, count: stats?.total ?? 0 },
    ...resolvedStages.map((stage) => ({
      value: stage.value,
      label: stage.label,
      token: stage.token,
      count: stats?.byStatus[stage.value] ?? 0,
    })),
  ];

  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-card p-4" aria-label={dictionary.stats.title}>
      <div className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-card)] border border-hairline sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <StatTile key={tile.value} label={tile.label} className="border-r border-hairline last:border-r-0">
          {loading ? (
            <Skeleton className="h-8 w-12" aria-label={dictionary.stats.loading} />
          ) : (
            <StatValue style={tile.token ? { color: `var(${tile.token}-strong)` } : undefined}>{tile.count}</StatValue>
          )}
        </StatTile>
      ))}
      </div>
      {!loading ? <KpiBreakdownBar items={resolvedStages.map((stage) => ({ label: stage.label, tone: stage.value, value: stats?.byStatus[stage.value] ?? 0 }))} toneTokens={Object.fromEntries(resolvedStages.map((stage) => [stage.value, stage.token]))} /> : null}
    </div>
  );
}
