"use client";

import { useEffect, useRef, useState } from "react";
import { Filter, Plus, Search } from "lucide-react";
import { Input } from "@brightweblabs/ui";
import { useProjectsUiDictionary } from "./context";
import {
  PROJECTS_EVENTS,
  dispatchProjectsCustomEvent,
  dispatchProjectsEvent,
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

const controlClassName = "relative inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border px-3 text-[length:var(--text-ui-action)] font-extrabold";

export function ProjectsToolbarControls() {
  const dictionary = useProjectsUiDictionary();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectsStatusFilter>("all");
  const [health, setHealth] = useState<ProjectsHealthFilter>("all");
  const [open, setOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<ProjectsStatusFilter>(status);
  const [draftHealth, setDraftHealth] = useState<ProjectsHealthFilter>(health);
  const wrapRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!open) return;
    const handleDocumentClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [open]);

  function openPopover() {
    setDraftStatus(status);
    setDraftHealth(health);
    setOpen(true);
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="inline-flex h-9 min-w-[var(--toolbar-search-min-width)] items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-[color:var(--muted-foreground)]">
        <Search className="size-[var(--toolbar-icon-size)] shrink-0" aria-hidden />
        <Input
          value={search}
          onChange={(event) => {
            const query = event.target.value;
            setSearch(query);
            dispatchProjectsCustomEvent(PROJECTS_EVENTS.setSearch, { query });
          }}
          placeholder={dictionary.toolbar.searchPlaceholder}
          aria-label={dictionary.toolbar.searchPlaceholder}
          className="h-8 w-full border-0 bg-transparent px-0 text-[length:var(--text-ui-action)] text-[color:var(--foreground)] shadow-none focus-visible:ring-0"
        />
      </label>

      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          className={cn(
            controlClassName,
            "border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] text-[color:var(--foreground)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)]",
            activeCount > 0 && "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)]",
          )}
          onClick={(event) => {
            event.stopPropagation();
            open ? setOpen(false) : openPopover();
          }}
        >
          <Filter className={cn("size-[var(--toolbar-icon-size)]", activeCount > 0 ? "text-[color:var(--accent)]" : "text-[color:var(--muted-foreground)]")} aria-hidden />
          {dictionary.toolbar.filters}
          {activeCount > 0 ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-[color:var(--project-ui-color-77)] text-ui-micro text-[color:var(--project-ui-color-78)]">{activeCount}</span> : null}
        </button>

        {open ? (
          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-[var(--toolbar-popover-width)] rounded-[var(--radius-toolbar-popover)] border border-[color:var(--border-strong)] bg-[color:var(--popover)] p-4 shadow-[var(--shadow-toolbar-popover)]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--foreground)]">{dictionary.toolbar.filters}</span>
              <button type="button" className="p-0 text-xs font-bold text-[color:var(--muted-foreground)] hover:text-[color:var(--accent)]" onClick={() => { setDraftStatus("all"); setDraftHealth("all"); }}>{dictionary.toolbar.clear}</button>
            </div>

            <div className="grid gap-3">
              <div>
                <span className="mb-2 block text-[length:var(--text-ui-micro)] font-extrabold uppercase tracking-[0.1em] text-[color:var(--muted-foreground)]">{dictionary.toolbar.status}</span>
                <div className="flex flex-wrap gap-2">
                  {STATUS_KEYS.map((key) => <button key={key} type="button" className={cn("inline-flex h-[var(--toolbar-chip-height)] items-center gap-2 rounded-full border px-3 text-[length:var(--text-ui-chip)] font-semibold text-[color:var(--foreground)]", draftStatus === key ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)]" : "border-[color:var(--hairline)] bg-[color:var(--elevate-1)]")} onClick={() => setDraftStatus(key)}>{STATUS_SWATCHES[key] ? <span className="size-[7px] rounded-full" style={{ background: STATUS_SWATCHES[key] }} /> : null}{key === "all" ? dictionary.toolbar.allStatuses : dictionary.status[key]}</button>)}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-[length:var(--text-ui-micro)] font-extrabold uppercase tracking-[0.1em] text-[color:var(--muted-foreground)]">{dictionary.toolbar.health}</span>
                <div className="flex flex-wrap gap-2">
                  {HEALTH_KEYS.map((key) => <button key={key} type="button" className={cn("inline-flex h-[var(--toolbar-chip-height)] items-center gap-2 rounded-full border px-3 text-[length:var(--text-ui-chip)] font-semibold text-[color:var(--foreground)]", draftHealth === key ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)]" : "border-[color:var(--hairline)] bg-[color:var(--elevate-1)]")} onClick={() => setDraftHealth(key)}>{HEALTH_SWATCHES[key] ? <span className="size-[7px] rounded-full" style={{ background: HEALTH_SWATCHES[key] }} /> : null}{key === "all" ? dictionary.toolbar.allHealth : dictionary.status[key]}</button>)}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <button type="button" className={cn(controlClassName, "w-full justify-center border-transparent bg-[color:var(--accent)] text-[color:var(--accent-foreground)] shadow-[var(--shadow-toolbar-control)]")} onClick={() => { setStatus(draftStatus); setHealth(draftHealth); dispatchProjectsCustomEvent(PROJECTS_EVENTS.setStatus, { status: draftStatus }); dispatchProjectsCustomEvent(PROJECTS_EVENTS.setHealth, { health: draftHealth }); setOpen(false); }}>{dictionary.toolbar.apply}</button>
            </div>
          </div>
        ) : null}
      </div>

      <button type="button" className={cn(controlClassName, "border-transparent bg-[color:var(--accent)] text-[color:var(--accent-foreground)] shadow-[var(--shadow-toolbar-control)]")} onClick={() => dispatchProjectsEvent(PROJECTS_EVENTS.openNewProject)}>
        <Plus className="size-[var(--toolbar-icon-size)]" aria-hidden />
        {dictionary.toolbar.newProject}
      </button>
    </div>
  );
}
