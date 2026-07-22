"use client";

import { FolderKanban } from "lucide-react";
import type { ListProjectsPayload } from "../projects-list-response-parser";
import { ProjectSummaryCard } from "../shared/project-summary-card";

type ProjectsPortfolioListProps = {
  data: ListProjectsPayload;
  hasActiveFilters: boolean;
};

export function ProjectsPortfolioList({
  data,
  hasActiveFilters,
}: ProjectsPortfolioListProps) {
  return (
    <div>
      {data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-sm px-6 py-14 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-[color:var(--muted)]">
            <FolderKanban className="size-5 text-[color:var(--muted-foreground)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--muted-foreground)]">
              {hasActiveFilters ? "Sem resultados" : "Nenhum projeto"}
            </p>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
              {hasActiveFilters
                ? "Ajusta os filtros para encontrar projetos."
                : "Cria o primeiro projeto para começar a acompanhar progresso."}
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
