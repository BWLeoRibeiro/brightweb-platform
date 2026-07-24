import { useEffect } from "react";
import { PROJECTS_EVENTS, dispatchProjectsCustomEvent, type ProjectsBoardMilestoneStateDetail, type ProjectsBoardSetMilestoneDetail } from "../events";
import type { ProjectMilestone } from "../../types";
import { useWindowEventBridge } from "../window-events";

type MilestoneFilterValue = "all" | "__none__" | string;

export function useProjectBoardMilestoneEvents({ milestones, milestoneFilter, onSetMilestoneFilter }: { milestones: ProjectMilestone[]; milestoneFilter: MilestoneFilterValue; onSetMilestoneFilter: (value: MilestoneFilterValue) => void }) {
  useEffect(() => {
    const detail: ProjectsBoardMilestoneStateDetail = { options: milestones.map((milestone) => ({ id: milestone.id, title: milestone.title })), selectedMilestoneId: milestoneFilter };
    dispatchProjectsCustomEvent(PROJECTS_EVENTS.boardMilestoneState, detail);
  }, [milestoneFilter, milestones]);

  useWindowEventBridge<ProjectsBoardSetMilestoneDetail>(PROJECTS_EVENTS.setBoardMilestone, (detail) => {
    const nextMilestone = detail?.milestoneId;
    if (nextMilestone === "all" || nextMilestone === "__none__" || (typeof nextMilestone === "string" && milestones.some((milestone) => milestone.id === nextMilestone))) onSetMilestoneFilter(nextMilestone);
    else onSetMilestoneFilter("all");
  });
}
