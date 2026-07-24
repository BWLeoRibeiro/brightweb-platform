import type { ProjectListItem } from "../types";

type ProjectItem = Pick<
  ProjectListItem,
  "id" | "organizationName" | "name" | "code" | "status" | "health" | "ownerLabel" | "targetDate" | "taskStats"
>;

export type ListProjectsPayload = {
  items: ProjectItem[];
  total: number;
  page: number;
  pageSize: number;
  attentionSummary: {
    total: number;
    overdue: number;
    atRisk: number;
  };
};
