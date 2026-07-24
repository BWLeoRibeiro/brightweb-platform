import { ProjectSummaryCardSkeleton } from "./shared/project-summary-card-skeleton";

export default function ProjectsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 pb-6 pt-0 md:pb-8">
      {/* A single ghost card — signals "loading" without faking a portfolio.
          No header here: the real page renders its own, so duplicating it
          only causes layout shift when the data resolves. */}
      <section className="projects-portfolio-grid grid gap-4">
        <ProjectSummaryCardSkeleton />
      </section>
    </div>
  );
}
