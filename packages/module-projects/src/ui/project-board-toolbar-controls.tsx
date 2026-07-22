"use client";

import { useEffect, useState } from "react";
import { Flag, Plus } from "lucide-react";
import { useProjectsUiDictionary } from "./context";
import { PROJECTS_EVENTS, dispatchProjectsCustomEvent, dispatchProjectsEvent, type ProjectsBoardMilestoneOption, type ProjectsBoardMilestoneStateDetail } from "./events";

export function ProjectBoardToolbarControls({ canCreateTask = true }: { canCreateTask?: boolean }) {
  const dictionary = useProjectsUiDictionary();
  const [options, setOptions] = useState<ProjectsBoardMilestoneOption[]>([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("all");

  useEffect(() => {
    const handleState = (event: Event) => {
      const detail = (event as CustomEvent<ProjectsBoardMilestoneStateDetail>).detail;
      setOptions(detail?.options ?? []);
      setSelectedMilestoneId(detail?.selectedMilestoneId ?? "all");
    };
    window.addEventListener(PROJECTS_EVENTS.boardMilestoneState, handleState);
    return () => window.removeEventListener(PROJECTS_EVENTS.boardMilestoneState, handleState);
  }, []);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--foreground)]">
        <Flag className="size-[var(--toolbar-icon-size)] text-[color:var(--muted-foreground)]" aria-hidden />
        <span className="sr-only">{dictionary.toolbar.milestoneFilter}</span>
        <select
          value={selectedMilestoneId}
          aria-label={dictionary.toolbar.milestoneFilter}
          className="max-w-48 bg-transparent text-[length:var(--text-ui-action)] font-extrabold outline-none"
          onChange={(event) => {
            const milestoneId = event.target.value;
            setSelectedMilestoneId(milestoneId);
            dispatchProjectsCustomEvent(PROJECTS_EVENTS.setBoardMilestone, { milestoneId });
          }}
        >
          <option value="all">{dictionary.toolbar.allMilestones}</option>
          <option value="__none__">{dictionary.toolbar.noMilestone}</option>
          {options.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
        </select>
      </label>
      {canCreateTask ? <button type="button" className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border border-transparent bg-[color:var(--accent)] px-3 text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--accent-foreground)] shadow-[var(--shadow-toolbar-control)]" onClick={() => dispatchProjectsEvent(PROJECTS_EVENTS.openNewTask)}><Plus className="size-[var(--toolbar-icon-size)]" aria-hidden />{dictionary.forms.newTask}</button> : null}
    </div>
  );
}
