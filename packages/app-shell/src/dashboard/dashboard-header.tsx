"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { Card } from "@brightweblabs/ui";
import type { DashboardSection } from "./types";
import { PillTabs } from "../components/pill-tabs";
import { useDashboardDictionary } from "./dashboard-context";
import { getGreeting, formatFullDate, TabKey } from "./dashboard-formatters";

function HeroMetricMini({ value, label, tone }: { value: number; label: string; tone: "risk" | "on" | "neutral" }) {
  const dot = tone === "risk"
    ? "var(--project-risk-overdue)"
    : tone === "on"
      ? "var(--project-state-active)"
      : "var(--project-hero-subtle)";
  return (
    <Card
      density="compact"
      className="flex-row items-center justify-between gap-4 px-4 py-2.5 shadow-none"
      style={{ borderColor: "var(--project-hero-border)", background: "var(--project-hero-surface-raised)" }}
    >
      <span className="inline-flex items-center gap-2 text-meta" style={{ color: "var(--project-hero-muted)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
        {label}
      </span>
      <span
        className="text-kpi text-[length:var(--text-ui-dashboard-card-title)] font-extrabold leading-none tracking-[var(--type-tracking-n030)]"
        style={{ color: "var(--project-hero-foreground)" }}
      >
        {value}
      </span>
    </Card>
  );
}

function HeroMetrics({ activeProjects, overdueProjects, newLeads }: { activeProjects: number; overdueProjects: number; newLeads: number }) {
  const dictionary = useDashboardDictionary();
  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[330px]">
      <Card
        density="default"
        className="min-w-[150px] justify-center px-5 py-4 shadow-none"
        style={{ borderColor: "var(--project-hero-border)", background: "var(--project-hero-surface-raised)" }}
      >
        <span
          className="text-kpi-lg text-[length:var(--text-ui-dashboard-metric)] font-black leading-[var(--type-leading-090)] tracking-[var(--type-tracking-n050)]"
          style={{ color: "var(--project-hero-foreground)" }}
        >
          {activeProjects}
        </span>
        <span className="mt-1.5 text-meta" style={{ color: "var(--project-hero-muted)" }}>
          {activeProjects === 1
            ? (dictionary.welcome.activeProjectOne ?? dictionary.welcome.activeProjects.replace(/^projetos ativos$/, "projeto ativo"))
            : (dictionary.welcome.activeProjectMany ?? dictionary.welcome.activeProjects)}
        </span>
      </Card>
      <div className="flex flex-col justify-between gap-3">
        <HeroMetricMini value={overdueProjects} label={dictionary.welcome.overdueProjects} tone={overdueProjects > 0 ? "risk" : "neutral"} />
        <HeroMetricMini value={newLeads} label={dictionary.welcome.newLeads} tone="on" />
      </div>
    </div>
  );
}

export function WelcomeHeader({
  name,
  urgentCount,
  unownedProjects,
  errors,
  activeProjects,
  overdueProjects,
  newLeads,
}: {
  name: string;
  urgentCount: number;
  unownedProjects: number;
  errors: string[];
  activeProjects: number;
  overdueProjects: number;
  newLeads: number;
}) {
  const dictionary = useDashboardDictionary();
  const [now, setNow] = useState<Date | null>(null);
  const greeting = now ? getGreeting(now.getHours(), dictionary) : dictionary.greeting.fallback;
  const dateLabel = now ? formatFullDate(now, dictionary) : dictionary.greeting.loadingDate;
  const time = now ? now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const allAttentionIsMissingOwners = unownedProjects > 0 && urgentCount === unownedProjects;

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="brand-panel relative overflow-hidden rounded-[var(--radius-panel)] p-6 text-[color:var(--project-hero-foreground)] md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full blur-3xl opacity-100 dark:opacity-40"
        style={{ background: "var(--dashboard-hero-glow)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "var(--dashboard-hero-highlight)" }}
      />

      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 lg:flex-1">
          <p
            className="inline-flex items-center gap-2 text-meta font-semibold"
            style={{ color: "var(--project-hero-muted)" }}
          >
            <CalendarDays className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
            <span className="text-data">{dateLabel}</span>
            <span className="opacity-40">·</span>
            <span className="text-data">{time}</span>
          </p>

          <h1 className="font-display mt-4 text-heading-1 text-[length:var(--text-ui-dashboard-title)] font-extrabold leading-[var(--type-leading-102)] tracking-[var(--type-tracking-n035)] md:text-[length:var(--text-ui-dashboard-title-lg)]">
            {greeting}
            {name ? (
              <>
                , <span style={{ color: "var(--accent)" }}>{name}</span>
              </>
            ) : (
              ""
            )}
            .
          </h1>

          <p className="mt-3 max-w-[32rem] text-body-lg" style={{ color: "var(--project-hero-muted)" }}>
            {allAttentionIsMissingOwners ? (
              <>
                <span className="font-semibold" style={{ color: "var(--project-hero-foreground)" }}>
                  {unownedProjects} {unownedProjects === 1 ? (dictionary.welcome.projectOne ?? "projeto") : (dictionary.welcome.projectMany ?? "projetos")}
                </span>{" "}
                {unownedProjects === 1 ? (dictionary.welcome.needsOwnerOne ?? "precisa de responsável.") : (dictionary.welcome.needsOwnerMany ?? "precisam de responsável.")}
              </>
            ) : urgentCount > 0 ? (
              <>
                <span className="font-semibold" style={{ color: "var(--project-hero-foreground)" }}>
                  {urgentCount} {urgentCount === 1 ? dictionary.welcome.urgentOne : dictionary.welcome.urgentMany}
                </span>{" "}
                {dictionary.welcome.attentionToday}
              </>
            ) : (
              dictionary.welcome.allClear
            )}
          </p>

          {errors.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2" role="status">
              {errors.map((error) => (
                <span
                  key={error}
                  className="dashboard-error inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-meta font-semibold leading-snug"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {error}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <HeroMetrics activeProjects={activeProjects} overdueProjects={overdueProjects} newLeads={newLeads} />
      </div>
    </header>
  );
}

export function TabsRow({ value, onChange, sections }: { value: TabKey; onChange: (v: TabKey) => void; sections: DashboardSection[] }) {
  const dictionary = useDashboardDictionary();
  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: dictionary.tabs.overview },
    ...(sections.includes("projects") ? [{ key: "projects" as const, label: dictionary.tabs.projects }] : []),
    ...(sections.includes("crm") ? [{ key: "clients" as const, label: dictionary.tabs.clients }] : []),
    ...(sections.includes("tasks") ? [{ key: "tasks" as const, label: dictionary.tabs.tasks }] : []),
  ];

  return <PillTabs ariaLabel="Dashboard" items={tabs.map((tab) => ({ value: tab.key, label: tab.label }))} value={value} onValueChange={onChange} />;
}
