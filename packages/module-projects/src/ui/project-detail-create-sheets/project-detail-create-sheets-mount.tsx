"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { PROJECTS_EVENTS } from "../events";
import { useOptionalProjectDetailData } from "../project-detail-data-provider";
import { useWindowEventBridge } from "../window-events";

type MilestoneOption = { id: string; title: string };
type MemberOption = { profileId: string; label: string };

type ProjectDetailCreateSheetsMountProps = {
  projectId: string;
  milestones?: MilestoneOption[];
  members?: MemberOption[];
  canCreateMilestonesAndTasks?: boolean;
  canCreateLinks?: boolean;
};

const ProjectMilestoneCreateSheetDynamic = dynamic(
  () => import("./project-milestone-create-sheet").then((mod) => mod.ProjectMilestoneCreateSheet),
  { ssr: false },
);

const ProjectTaskCreateSheetDynamic = dynamic(
  () => import("./project-task-create-sheet").then((mod) => mod.ProjectTaskCreateSheet),
  { ssr: false },
);

const ProjectLinkCreateSheetDynamic = dynamic(
  () => import("./project-link-create-sheet").then((mod) => mod.ProjectLinkCreateSheet),
  { ssr: false },
);

function ProjectMilestoneCreateSheetLazy({ projectId }: { projectId: string }) {
  const [shouldMount, setShouldMount] = useState(false);

  useWindowEventBridge(PROJECTS_EVENTS.openNewMilestone, () => {
    setShouldMount(true);
  }, { custom: false });

  return shouldMount ? <ProjectMilestoneCreateSheetDynamic projectId={projectId} initialOpen /> : null;
}

function ProjectTaskCreateSheetLazy({
  projectId,
  milestones,
  members,
}: {
  projectId: string;
  milestones: MilestoneOption[];
  members: MemberOption[];
}) {
  const [shouldMount, setShouldMount] = useState(false);

  useWindowEventBridge(PROJECTS_EVENTS.openNewTask, () => {
    setShouldMount(true);
  }, { custom: false });

  return shouldMount ? (
    <ProjectTaskCreateSheetDynamic
      projectId={projectId}
      milestones={milestones}
      members={members}
      initialOpen
    />
  ) : null;
}

function ProjectLinkCreateSheetLazy({ projectId }: { projectId: string }) {
  const [shouldMount, setShouldMount] = useState(false);

  useWindowEventBridge(PROJECTS_EVENTS.openNewLink, () => {
    setShouldMount(true);
  }, { custom: false });

  return shouldMount ? <ProjectLinkCreateSheetDynamic projectId={projectId} initialOpen /> : null;
}

export function ProjectDetailCreateSheetsMount({
  projectId,
  milestones: milestoneProps = [],
  members: memberProps = [],
  canCreateMilestonesAndTasks = true,
  canCreateLinks = true,
}: ProjectDetailCreateSheetsMountProps) {
  const detailData = useOptionalProjectDetailData();
  const milestoneOptions = detailData
    ? detailData.milestones.map((milestone) => ({ id: milestone.id, title: milestone.title }))
    : milestoneProps;
  const memberOptions = detailData
    ? detailData.members.map((member) => ({ profileId: member.profileId, label: member.label }))
    : memberProps;

  return (
    <>
      {canCreateMilestonesAndTasks ? <ProjectMilestoneCreateSheetLazy projectId={projectId} /> : null}
      {canCreateMilestonesAndTasks ? (
        <ProjectTaskCreateSheetLazy projectId={projectId} milestones={milestoneOptions} members={memberOptions} />
      ) : null}
      {canCreateLinks ? <ProjectLinkCreateSheetLazy projectId={projectId} /> : null}
    </>
  );
}
