import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
export {
  PROJECT_HEALTH_STATES,
  PROJECT_STATUSES,
  getProjectPortfolioStats,
  isProjectsSchemaMissingError,
  listProjects,
  type ListProjectsParams,
  type ProjectHealth,
  type ProjectListItem,
  type ProjectStatus,
  type ProjectsDueWindow,
  type ProjectsListResult,
  type ProjectsPortfolioPageData,
  type ProjectsPortfolioStats,
} from "./data";
import {
  getProjectPortfolioStats,
  isProjectsSchemaMissingError,
  listProjects,
  type ProjectsListResult,
  type ProjectsPortfolioPageData,
  type ProjectsPortfolioStats,
} from "./data";

export async function getProjectsPortfolioPageData(): Promise<ProjectsPortfolioPageData> {
  const { supabase } = await requireServerPageAccess();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(500);

  const organizationOptions = ((organizations ?? []) as { id: string; name: string }[]).map((organization) => ({
    id: organization.id,
    name: organization.name,
  }));

  let result: ProjectsListResult;
  let portfolioStats: ProjectsPortfolioStats;
  let schemaMissing = false;

  try {
    [portfolioStats, result] = await Promise.all([
      getProjectPortfolioStats(supabase),
      listProjects(supabase, { page: 1, pageSize: 9, dueWindow: "all" }),
    ]);
  } catch (error) {
    if (isProjectsSchemaMissingError(error)) {
      schemaMissing = true;
      portfolioStats = { total: 0, planned: 0, active: 0, atRisk: 0, overdue: 0 };
      result = { items: [], total: 0, page: 1, pageSize: 9 };
    } else {
      throw error;
    }
  }

  return {
    organizationOptions,
    portfolioStats,
    result,
    schemaMissing,
  };
}
