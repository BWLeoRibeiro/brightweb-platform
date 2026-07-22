"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { PROJECTS_EVENTS } from "./events";
import { useWindowEventBridge } from "./window-events";

type ProjectEditSheetLazyProps = {
  projectId: string;
  initial?: {
    name: string;
    code: string | null;
    status: string;
    targetDate: string | null;
    cancellationReason: string | null;
    summary: string | null;
  };
};

type ProjectMembersEditSheetLazyProps = {
  projectId: string;
  initialMembers: Array<{ profileId: string; role: "owner" | "contributor" | "observer" }>;
};

const ProjectEditSheetDynamic = dynamic(
  () => import("./project-edit-sheet").then((mod) => mod.ProjectEditSheet),
  { ssr: false },
);

const ProjectMembersEditSheetDynamic = dynamic(
  () => import("./project-members-edit-sheet").then((mod) => mod.ProjectMembersEditSheet),
  { ssr: false },
);

export function ProjectEditSheetLazy(props: ProjectEditSheetLazyProps) {
  const [shouldMount, setShouldMount] = useState(false);

  useWindowEventBridge(PROJECTS_EVENTS.openEditProject, () => {
    setShouldMount(true);
  }, { custom: false });

  return shouldMount ? <ProjectEditSheetDynamic {...props} initialOpen /> : null;
}

export function ProjectMembersEditSheetLazy(props: ProjectMembersEditSheetLazyProps) {
  return <ProjectMembersEditSheetDynamic {...props} />;
}
