"use client";

import { CalendarClock, Clock3, TriangleAlert, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@brightweblabs/ui";
import { cn } from "../utils";
import type { ProjectsHealthFilter, ProjectsStatusFilter } from "../events";

type ProjectsPortfolioStatsProps = {
  portfolioStats: {
    total: number;
    planned: number;
    active: number;
    atRisk: number;
    overdue: number;
  };
  status: ProjectsStatusFilter;
  health: ProjectsHealthFilter;
  onApplyFilters: (status: ProjectsStatusFilter, health: ProjectsHealthFilter) => void;
};

export function ProjectsPortfolioStats({
  portfolioStats,
  status,
  health,
  onApplyFilters,
}: ProjectsPortfolioStatsProps) {
  const totalProjects = Math.max(portfolioStats.total, 1);
  const topStats = [
    {
      label: "Planeamento",
      value: portfolioStats.planned,
      description: "ainda por iniciar",
      Icon: CalendarClock,
      pct: Math.round((portfolioStats.planned / totalProjects) * 100),
      statusFilter: "planned" as ProjectsStatusFilter,
      healthFilter: "all" as ProjectsHealthFilter,
      cardCn:
        "border-[color:var(--project-ui-color-43)] bg-[color:var(--project-ui-color-44)]",
      iconWrapCn: "bg-[color:var(--project-ui-color-45)]",
      iconCn: "text-[color:var(--project-state-planned-strong)]",
      valueCn: "text-[color:var(--project-state-planned-strong)]",
      labelCn: "text-[color:var(--project-ui-color-46)]",
      descCn: "text-[color:var(--project-ui-color-47)]",
      barCn: "bg-[color:var(--project-state-planned)]",
      orbCn: "bg-[color:var(--project-state-planned)]",
      pctCn: "text-[color:var(--project-ui-color-48)]",
    },
    {
      label: "Ativos",
      value: portfolioStats.active,
      description: "em execução",
      Icon: Zap,
      pct: Math.round((portfolioStats.active / totalProjects) * 100),
      statusFilter: "active" as ProjectsStatusFilter,
      healthFilter: "all" as ProjectsHealthFilter,
      cardCn:
        "border-[color:var(--project-ui-color-49)] bg-[color:var(--project-ui-color-50)]",
      iconWrapCn: "bg-[color:var(--project-ui-color-13)]",
      iconCn: "text-[color:var(--project-state-active-strong)]",
      valueCn: "text-[color:var(--project-state-active-strong)]",
      labelCn: "text-[color:var(--project-ui-color-51)]",
      descCn: "text-[color:var(--project-ui-color-52)]",
      barCn: "bg-[color:var(--project-state-active)]",
      orbCn: "bg-[color:var(--project-state-active)]",
      pctCn: "text-[color:var(--project-ui-color-53)]",
    },
    {
      label: "Em risco",
      value: portfolioStats.atRisk,
      description: "saúde a exigir atenção",
      Icon: TriangleAlert,
      pct: Math.round((portfolioStats.atRisk / totalProjects) * 100),
      statusFilter: "all" as ProjectsStatusFilter,
      healthFilter: "at_risk" as ProjectsHealthFilter,
      cardCn:
        "border-[color:var(--project-ui-color-54)] bg-[color:var(--project-ui-color-55)]",
      iconWrapCn: "bg-[color:var(--project-ui-color-56)]",
      iconCn: "text-[color:var(--project-risk-at-risk-strong)]",
      valueCn: "text-[color:var(--project-risk-at-risk-strong)]",
      labelCn: "text-[color:var(--project-ui-color-57)]",
      descCn: "text-[color:var(--project-ui-color-58)]",
      barCn: "bg-[color:var(--project-risk-at-risk)]",
      orbCn: "bg-[color:var(--project-risk-at-risk)]",
      pctCn: "text-[color:var(--project-ui-color-59)]",
    },
    {
      label: "Atrasados",
      value: portfolioStats.overdue,
      description: "fora do prazo",
      Icon: Clock3,
      pct: Math.round((portfolioStats.overdue / totalProjects) * 100),
      statusFilter: "all" as ProjectsStatusFilter,
      healthFilter: "off_track" as ProjectsHealthFilter,
      cardCn:
        "border-[color:var(--project-ui-color-60)] bg-[color:var(--project-ui-color-61)]",
      iconWrapCn: "bg-[color:var(--project-ui-color-05)]",
      iconCn: "text-[color:var(--project-risk-overdue-strong)]",
      valueCn: "text-[color:var(--project-risk-overdue-strong)]",
      labelCn: "text-[color:var(--project-ui-color-62)]",
      descCn: "text-[color:var(--project-ui-color-63)]",
      barCn: "bg-[color:var(--project-risk-overdue)]",
      orbCn: "bg-[color:var(--project-risk-overdue)]",
      pctCn: "text-[color:var(--project-ui-color-64)]",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <TooltipProvider>
        {topStats.map((stat) => {
          const Icon = stat.Icon;
          const isActive = status === stat.statusFilter && health === stat.healthFilter;

          return (
            <Tooltip key={stat.label}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onApplyFilters(isActive ? "all" : stat.statusFilter, isActive ? "all" : stat.healthFilter)}
                  className={cn(
                    "dashboard-reveal group relative overflow-hidden rounded-3xl border p-5 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
                    stat.cardCn,
                    isActive && "ring-1 ring-primary/45",
                  )}
                  aria-pressed={isActive}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute -right-5 -top-5 size-24 rounded-full opacity-[0.18] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.28]",
                      stat.orbCn,
                    )}
                  />
                  <div className={cn("mb-4 flex w-fit items-center justify-center rounded-xl p-1.5", stat.iconWrapCn)}>
                    <Icon className={cn("size-4", stat.iconCn)} />
                  </div>
                  <p className={cn("text-3xl font-semibold tracking-tight", stat.valueCn)}>
                    {stat.value.toLocaleString("pt-PT")}
                  </p>
                  <div className="mt-1 flex items-baseline justify-between gap-1">
                    <p className={cn("text-xs font-semibold", stat.labelCn)}>{stat.label}</p>
                    <span className={cn("text-[10px] font-semibold tabular-nums", stat.pctCn)}>{stat.pct}%</span>
                  </div>
                  <p className={cn("mt-0.5 text-[10px]", stat.descCn)}>{stat.description}</p>
                  <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-black/8 dark:bg-white/8">
                    <div
                      className={cn("h-full rounded-full transition-all duration-1000 ease-out", stat.barCn)}
                      style={{ width: `${stat.pct}%` }}
                    />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isActive ? "Filtro ativo. Clique para limpar." : `Filtrar por ${stat.label.toLowerCase()}.`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
}
