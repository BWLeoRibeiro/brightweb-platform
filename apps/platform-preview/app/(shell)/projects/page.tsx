import { getProjectsPortfolioPageData } from "@brightweblabs/module-projects";
import { ProjectsPageLiveMount } from "./projects-live-mounts";

export default async function ProjectsPreviewPage() {
  const { organizationOptions, portfolioStats, result } = await getProjectsPortfolioPageData();
  const attentionSummary = {
    total: result.total,
    overdue: result.items.filter((project) => project.taskStats.overdue > 0).length,
    atRisk: result.items.filter((project) => project.health === "at_risk").length,
  };

  return (
    <ProjectsPageLiveMount
      initialData={{ ...result, attentionSummary }}
      initialUpdatedAt={new Date().toISOString()}
      portfolioStats={portfolioStats}
      organizations={organizationOptions}
      navigation={{
        listHref: "/projects",
        detailHref: (id) => `/projects/${id}`,
        boardHref: (id) => `/projects/${id}/tasks`,
      }}
    />
  );
}
