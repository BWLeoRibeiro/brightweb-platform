"use client";

import { useEffect, useState } from "react";
import { Flag, Plus } from "lucide-react";
import { useShellActionDispatch, useShellActionReady } from "@brightweblabs/app-shell";
import { Button } from "@brightweblabs/ui";
import { useProjectsUiDictionary } from "./context";
import { PROJECTS_EVENTS, type ProjectsBoardMilestoneOption, type ProjectsBoardMilestoneStateDetail } from "./events";

export function ProjectBoardToolbarControls({ canCreateTask = true }: { canCreateTask?: boolean }) {
  const dictionary = useProjectsUiDictionary();
  const dispatchShellAction = useShellActionDispatch();
  const milestoneActionReady = useShellActionReady(PROJECTS_EVENTS.setBoardMilestone);
  const newTaskActionReady = useShellActionReady(PROJECTS_EVENTS.openNewTask);
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
      <label className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-body text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--foreground)]">
        <Flag className="size-[var(--toolbar-icon-size)] text-[color:var(--muted-foreground)]" aria-hidden />
        <span className="sr-only">{dictionary.toolbar.milestoneFilter}</span>
        <select
          value={selectedMilestoneId}
          disabled={!milestoneActionReady}
          aria-label={dictionary.toolbar.milestoneFilter}
          className="max-w-48 bg-transparent text-body text-[length:var(--text-ui-action)] font-extrabold outline-none"
          onChange={(event) => {
            const milestoneId = event.target.value;
            setSelectedMilestoneId(milestoneId);
            dispatchShellAction(PROJECTS_EVENTS.setBoardMilestone, { milestoneId });
          }}
        >
          <option value="all">{dictionary.toolbar.allMilestones}</option>
          <option value="__none__">{dictionary.toolbar.noMilestone}</option>
          {options.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
        </select>
      </label>
      {canCreateTask ? <Button type="button" disabled={!newTaskActionReady} onClick={() => dispatchShellAction(PROJECTS_EVENTS.openNewTask)}><Plus data-icon="inline-start" aria-hidden />{dictionary.forms.newTask}</Button> : null}
    </div>
  );
}
