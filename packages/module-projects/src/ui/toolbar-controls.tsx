"use client";

import { useEffect, useState } from "react";
import { Filter, Plus } from "lucide-react";
import { ToolbarSearchField, useShellActionDispatch, useShellActionReady, useShellActionsReady } from "@brightweblabs/app-shell";
import { Popover, PopoverContent, PopoverTrigger } from "@brightweblabs/ui";
import { useProjectsUiDictionary } from "./context";
import {
  PROJECTS_EVENTS,
  type ProjectsHealthFilter,
  type ProjectsStateEventDetail,
  type ProjectsStatusFilter,
} from "./events";
import { cn } from "./utils";

const STATUS_KEYS: ProjectsStatusFilter[] = ["all", "planned", "active", "blocked", "completed", "canceled"];
const HEALTH_KEYS: ProjectsHealthFilter[] = ["all", "on_track", "at_risk", "off_track"];
const STATUS_SWATCHES: Partial<Record<ProjectsStatusFilter, string>> = {
  planned: "var(--project-state-planned)",
  active: "var(--project-state-active)",
  blocked: "var(--project-state-blocked)",
  completed: "var(--project-state-completed)",
  canceled: "var(--project-state-canceled)",
};
const HEALTH_SWATCHES: Partial<Record<ProjectsHealthFilter, string>> = {
  on_track: "var(--project-state-active)",
  at_risk: "var(--project-risk-at-risk)",
  off_track: "var(--project-risk-overdue)",
};

const controlClassName = "relative inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border px-3 text-body text-[length:var(--text-ui-action)] font-extrabold";

export function ProjectsToolbarControls() {
  const dictionary = useProjectsUiDictionary();
  const dispatchShellAction = useShellActionDispatch();
  const newProjectReady = useShellActionReady(PROJECTS_EVENTS.openNewProject);
  const filtersReady = useShellActionsReady([
    PROJECTS_EVENTS.setSearch,
    PROJECTS_EVENTS.setStatus,
    PROJECTS_EVENTS.setHealth,
  ]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectsStatusFilter>("all");
  const [health, setHealth] = useState<ProjectsHealthFilter>("all");
  const [open, setOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<ProjectsStatusFilter>(status);
  const [draftHealth, setDraftHealth] = useState<ProjectsHealthFilter>(health);
  const activeCount = (status !== "all" ? 1 : 0) + (health !== "all" ? 1 : 0);

  useEffect(() => {
    const handleState = (event: Event) => {
      const detail = (event as CustomEvent<ProjectsStateEventDetail>).detail;
      if (typeof detail?.search === "string") setSearch(detail.search);
      if (detail?.status) setStatus(detail.status);
      if (detail?.health) setHealth(detail.health);
    };
    window.addEventListener(PROJECTS_EVENTS.state, handleState);
    return () => window.removeEventListener(PROJECTS_EVENTS.state, handleState);
  }, []);

  function openPopover() {
    setDraftStatus(status);
    setDraftHealth(health);
    setOpen(true);
  }

  return (
    <div className="flex min-w-max items-center gap-2">
      <ToolbarSearchField
        value={search}
        disabled={!filtersReady}
        placeholder={dictionary.toolbar.searchPlaceholder}
        onChange={(query) => {
          setSearch(query);
          dispatchShellAction(PROJECTS_EVENTS.setSearch, { query });
        }}
      />

      <Popover open={open} onOpenChange={(next) => next ? openPopover() : setOpen(false)}>
        <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!filtersReady}
          className={cn(
            controlClassName,
            "border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] text-[color:var(--foreground)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-60",
            activeCount > 0 && "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)]",
          )}
        >
          <Filter className={cn("size-[var(--toolbar-icon-size)]", activeCount > 0 ? "text-[color:var(--accent)]" : "text-[color:var(--muted-foreground)]")} aria-hidden />
          {dictionary.toolbar.filters}
          {activeCount > 0 ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-[color:var(--project-ui-color-77)] text-micro text-[color:var(--project-ui-color-78)]">{activeCount}</span> : null}
        </button>
        </PopoverTrigger>

        <PopoverContent align="end" collisionPadding={12} className="w-[min(var(--toolbar-popover-width),calc(100vw-2rem))] rounded-[var(--radius-toolbar-popover)] border border-[color:var(--border-strong)] bg-[color:var(--popover)] p-4 shadow-[var(--shadow-toolbar-popover)]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-body text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--foreground)]">{dictionary.toolbar.filters}</span>
              <button type="button" className="p-0 text-meta font-bold text-[color:var(--muted-foreground)] underline-offset-2 hover:text-[color:var(--foreground)] hover:underline" onClick={() => { setDraftStatus("all"); setDraftHealth("all"); }}>{dictionary.toolbar.clear}</button>
            </div>

            <div className="grid gap-3">
              <div>
                <span className="mb-2 block text-micro font-extrabold uppercase tracking-[var(--type-tracking-100)] text-[color:var(--muted-foreground)]">{dictionary.toolbar.status}</span>
                <div className="flex flex-wrap gap-2">
                  {STATUS_KEYS.map((key) => <button key={key} type="button" className={cn("inline-flex h-[var(--toolbar-chip-height)] items-center gap-2 rounded-full border px-3 text-meta text-[length:var(--text-ui-chip)] font-semibold text-[color:var(--foreground)]", draftStatus === key ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)]" : "border-[color:var(--hairline)] bg-[color:var(--elevate-1)]")} onClick={() => setDraftStatus(key)}>{STATUS_SWATCHES[key] ? <span className="size-[7px] rounded-full" style={{ background: STATUS_SWATCHES[key] }} /> : null}{key === "all" ? dictionary.toolbar.allStatuses : dictionary.status[key]}</button>)}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-micro font-extrabold uppercase tracking-[var(--type-tracking-100)] text-[color:var(--muted-foreground)]">{dictionary.toolbar.health}</span>
                <div className="flex flex-wrap gap-2">
                  {HEALTH_KEYS.map((key) => <button key={key} type="button" className={cn("inline-flex h-[var(--toolbar-chip-height)] items-center gap-2 rounded-full border px-3 text-meta text-[length:var(--text-ui-chip)] font-semibold text-[color:var(--foreground)]", draftHealth === key ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)]" : "border-[color:var(--hairline)] bg-[color:var(--elevate-1)]")} onClick={() => setDraftHealth(key)}>{HEALTH_SWATCHES[key] ? <span className="size-[7px] rounded-full" style={{ background: HEALTH_SWATCHES[key] }} /> : null}{key === "all" ? dictionary.toolbar.allHealth : dictionary.status[key]}</button>)}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <button type="button" className={cn(controlClassName, "w-full justify-center border-transparent bg-[color:var(--accent)] text-[color:var(--accent-foreground)] shadow-[var(--shadow-toolbar-control)]")} onClick={() => { setStatus(draftStatus); setHealth(draftHealth); dispatchShellAction(PROJECTS_EVENTS.setStatus, { status: draftStatus }); dispatchShellAction(PROJECTS_EVENTS.setHealth, { health: draftHealth }); setOpen(false); }}>{dictionary.toolbar.apply}</button>
            </div>
        </PopoverContent>
      </Popover>

      <button type="button" className={cn(controlClassName, "border-transparent bg-[color:var(--accent)] text-[color:var(--accent-foreground)] shadow-[var(--shadow-toolbar-control)] disabled:cursor-not-allowed disabled:opacity-60")} disabled={!newProjectReady} onClick={() => dispatchShellAction(PROJECTS_EVENTS.openNewProject)}>
        <Plus className="size-[var(--toolbar-icon-size)]" aria-hidden />
        {dictionary.toolbar.newProject}
      </button>
    </div>
  );
}
