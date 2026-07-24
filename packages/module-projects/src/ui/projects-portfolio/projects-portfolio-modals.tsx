"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { PROJECTS_EVENTS } from "../events";
import type { OrganizationOption } from "./types";
import { useWindowEventBridge } from "../window-events";

type ProjectOption = { id: string; name: string; organizationName?: string };

type ProjectsPortfolioModalsProps = {
  organizations: OrganizationOption[];
  projects: ProjectOption[];
};

const CreateProjectSheetDynamic = dynamic(
  () => import("../create-project-sheet").then((mod) => mod.CreateProjectSheet),
  { ssr: false },
);

const CreateProjectTaskSheetDynamic = dynamic(
  () => import("../create-project-task-sheet").then((mod) => mod.CreateProjectTaskSheet),
  { ssr: false },
);

function CreateProjectSheetLazy({ organizations }: { organizations: OrganizationOption[] }) {
  const [shouldMount, setShouldMount] = useState(false);

  useWindowEventBridge(PROJECTS_EVENTS.openNewProject, () => {
    setShouldMount(true);
  }, { custom: false });

  return shouldMount ? <CreateProjectSheetDynamic organizations={organizations} initialOpen /> : null;
}

function CreateProjectTaskSheetLazy({ projects }: { projects: ProjectOption[] }) {
  const [shouldMount, setShouldMount] = useState(false);

  useWindowEventBridge(PROJECTS_EVENTS.openNewTask, () => {
    setShouldMount(true);
  }, { custom: false });

  return shouldMount ? <CreateProjectTaskSheetDynamic projects={projects} initialOpen /> : null;
}

export function ProjectsPortfolioModals({
  organizations,
  projects,
}: ProjectsPortfolioModalsProps) {
  return (
    <>
      <CreateProjectSheetLazy organizations={organizations} />
      <CreateProjectTaskSheetLazy projects={projects} />
    </>
  );
}
