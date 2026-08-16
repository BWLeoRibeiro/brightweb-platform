import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import type { ProjectsListResult, ProjectsPortfolioPageData, ProjectsPortfolioStats } from "./data";
import { getProjectPortfolioStats, isProjectsSchemaMissingError, listProjects } from "./server";

export async function getProjectsPortfolioPageData(): Promise<ProjectsPortfolioPageData> {
  const { supabase } = await requireServerPageRoleAccess(["staff", "admin"]);
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
      listProjects(supabase, { page: 1, pageSize: 9, dueWindow: "all", status: "all" }),
    ]);
  } catch (error) {
    if (!isProjectsSchemaMissingError(error)) throw error;
    schemaMissing = true;
    portfolioStats = { total: 0, planned: 0, active: 0, atRisk: 0, overdue: 0 };
    result = { items: [], total: 0, page: 1, pageSize: 9 };
  }
  return { organizationOptions, portfolioStats, result, schemaMissing };
}
