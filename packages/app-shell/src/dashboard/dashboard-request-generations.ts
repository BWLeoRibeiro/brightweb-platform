import type { DashboardSection } from "./types";

export type DashboardRequestGeneration = Partial<Record<DashboardSection, number>>;

export function createDashboardRequestGenerations() {
  const generations: Record<DashboardSection, number> = {
    projects: 0,
    crm: 0,
    tasks: 0,
  };

  return {
    begin(sections: DashboardSection[]): DashboardRequestGeneration {
      return Object.fromEntries(
        sections.map((section) => [section, ++generations[section]]),
      );
    },
    isCurrent(request: DashboardRequestGeneration, section: DashboardSection) {
      return request[section] === generations[section];
    },
  };
}
