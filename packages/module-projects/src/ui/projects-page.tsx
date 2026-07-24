"use client";

import type { ReactNode } from "react";
import type { ProjectsPortfolioStats } from "../data";
import { ProjectsUiProvider } from "./context";
import { defaultProjectsUiDictionary } from "./dictionary";
import type { ListProjectsPayload } from "./projects-list-response-parser";
import { ProjectsPortfolioRoot } from "./projects-portfolio/projects-portfolio-root";
import type { OrganizationOption } from "./projects-portfolio/types";
import type { ProjectsNavigationConfig, ProjectsPageSlots, ProjectsUiClient, ProjectsUiDictionary } from "./types";

const EMPTY_STATS: ProjectsPortfolioStats = { total: 0, planned: 0, active: 0, atRisk: 0, overdue: 0 };
const EMPTY_LIST: ListProjectsPayload = { items: [], total: 0, page: 1, pageSize: 12, attentionSummary: { total: 0, overdue: 0, atRisk: 0 } };

export type ProjectsPageProps = {
  client?: ProjectsUiClient;
  initialData?: ListProjectsPayload;
  initialUpdatedAt?: string | null;
  portfolioStats?: ProjectsPortfolioStats;
  organizations?: OrganizationOption[];
  dictionary?: ProjectsUiDictionary;
  navigation?: Partial<ProjectsNavigationConfig>;
  slots?: ProjectsPageSlots;
  loadOnMount?: boolean;
};

export function ProjectsPage({ client, initialData, initialUpdatedAt, portfolioStats = EMPTY_STATS, organizations = [], dictionary = defaultProjectsUiDictionary, navigation, slots, loadOnMount }: ProjectsPageProps) {
  return <ProjectsUiProvider client={client} dictionary={dictionary} navigation={navigation}>
    {slots?.beforePortfolio}
    <ProjectsPortfolioRoot initialData={initialData ?? EMPTY_LIST} initialUpdatedAt={initialUpdatedAt} portfolioStats={portfolioStats} organizations={organizations} loadOnMount={loadOnMount ?? !initialData} />
    {slots?.afterPortfolio}
  </ProjectsUiProvider>;
}

export default ProjectsPage;
