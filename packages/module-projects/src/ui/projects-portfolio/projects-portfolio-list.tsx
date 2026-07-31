"use client";

import { FolderKanban } from "lucide-react";
import type { ListProjectsPayload } from "../projects-list-response-parser";
import { ProjectSummaryCard } from "../shared/project-summary-card";
import { useProjectsUiDictionary } from "../context";

type ProjectsPortfolioListProps = {
  data: ListProjectsPayload;
  hasActiveFilters: boolean;
  isLoading?: boolean;
};

export function ProjectsPortfolioList({
  data,
  hasActiveFilters,
  isLoading = false,
}: ProjectsPortfolioListProps) {
  const dictionary = useProjectsUiDictionary();
  return (
    <div aria-busy={isLoading} className={`transition-opacity duration-150 motion-reduce:transition-none ${isLoading && data.items.length > 0 ? "opacity-60" : ""}`}>
      {data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-sm px-6 py-14 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-[color:var(--muted)]">
            <FolderKanban className="size-5 text-[color:var(--muted-foreground)]" />
          </div>
          <div>
            <p className="text-body font-semibold text-[color:var(--muted-foreground)]">
              {isLoading ? dictionary.portfolio.loading : hasActiveFilters ? dictionary.portfolio.filteredEmptyTitle : dictionary.portfolio.emptyTitle}
            </p>
            <p className="mt-1 text-meta text-[color:var(--muted-foreground)]">
              {isLoading
                ? dictionary.portfolio.loading
                : hasActiveFilters
                ? dictionary.portfolio.filteredEmptyHint
                : dictionary.portfolio.emptyHint}
            </p>
          </div>
        </div>
      ) : (
        <div className="projects-portfolio-grid grid gap-md">
          {data.items.map((project) => (
            <ProjectSummaryCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
