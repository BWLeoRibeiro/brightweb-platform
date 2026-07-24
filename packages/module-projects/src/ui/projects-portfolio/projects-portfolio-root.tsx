"use client";

import type { CSSProperties } from "react";
import { ProjectsPortfolioList } from "./projects-portfolio-list";
import { ProjectsPortfolioModals } from "./projects-portfolio-modals";
import { ProjectsPortfolioPagination } from "./projects-portfolio-pagination";
import type { ProjectsPortfolioRootProps } from "./types";
import { useProjectsPortfolioBridge } from "./use-projects-portfolio-bridge";
import { useProjectsPortfolioController } from "./use-projects-portfolio-controller";

export function ProjectsPortfolioRoot({
  initialData,
  initialUpdatedAt = null,
  organizations,
  loadOnMount = false,
}: ProjectsPortfolioRootProps) {
  const controller = useProjectsPortfolioController(initialData, { initialUpdatedAt, loadOnMount });

  useProjectsPortfolioBridge(controller);

  return (
    <div
      className="min-h-0"
      style={
        {
          ["--muted-foreground" as string]: "var(--project-ui-color-40)",
          ["--border" as string]: "var(--project-ui-color-41)",
          ["--muted" as string]: "var(--project-ui-color-42)",
        } as CSSProperties
      }
    >
      {/* Page header (title + new project + filters) lives in the sticky top navbar. */}
      <div className="mx-auto w-full max-w-[1480px] pb-lg pt-0 md:pb-xl">
        <ProjectsPortfolioList
          data={controller.data}
          hasActiveFilters={controller.hasActiveFilters}
        />
        <ProjectsPortfolioPagination
          page={controller.page}
          totalPages={controller.totalPages}
          onPageChange={controller.setPage}
        />

        <ProjectsPortfolioModals
          organizations={organizations}
          projects={controller.data.items.map((project) => ({
            id: project.id,
            name: project.name,
            organizationName: project.organizationName,
          }))}
        />
      </div>
    </div>
  );
}
