import type { ProjectsNavigationConfig } from "./types";

const DEFAULT_PROJECTS_NAVIGATION = {
  listHref: "/projects",
  detailHrefPattern: "/projects/:projectId",
  boardHrefPattern: "/projects/:projectId/tasks",
  organizationHrefPattern: "/crm",
} satisfies ProjectsNavigationConfig;

export type ResolvedProjectsNavigationConfig = {
  listHref: string;
  detailHref: (projectId: string) => string;
  boardHref: (projectId: string) => string;
  organizationHref: (organizationId: string) => string;
};

function resolveHrefPattern(pattern: string, placeholder: string, id: string) {
  return pattern.split(placeholder).join(encodeURIComponent(id));
}

export function resolveProjectsNavigation(
  navigation: Partial<ProjectsNavigationConfig> = {},
): ResolvedProjectsNavigationConfig {
  const detailHrefPattern = navigation.detailHrefPattern ?? DEFAULT_PROJECTS_NAVIGATION.detailHrefPattern;
  const boardHrefPattern = navigation.boardHrefPattern ?? DEFAULT_PROJECTS_NAVIGATION.boardHrefPattern;
  const organizationHrefPattern = navigation.organizationHrefPattern ?? DEFAULT_PROJECTS_NAVIGATION.organizationHrefPattern;

  return {
    listHref: navigation.listHref ?? DEFAULT_PROJECTS_NAVIGATION.listHref,
    detailHref: (projectId) => resolveHrefPattern(detailHrefPattern, ":projectId", projectId),
    boardHref: (projectId) => resolveHrefPattern(boardHrefPattern, ":projectId", projectId),
    organizationHref: (organizationId) => resolveHrefPattern(organizationHrefPattern, ":organizationId", organizationId),
  };
}
