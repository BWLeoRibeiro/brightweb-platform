"use client";

import { AppDashboard, type DashboardDataClient } from "@brightweblabs/app-shell";
import { getStarterShellConfig } from "../../../config/shell";

async function getJson(path: string, signal?: AbortSignal) {
  const response = await fetch(path, { cache: "no-store", signal });
  return response.json();
}

const dashboardClient: DashboardDataClient = {
  getProjects: (options) => getJson("/api/dashboard/projects", options?.signal),
  getCrm: (options) => getJson("/api/dashboard/crm", options?.signal),
  getTasks: (options) => getJson("/api/dashboard/tasks", options?.signal),
};

export function DashboardLiveMount() {
  const { dashboardContributions } = getStarterShellConfig();
  return <AppDashboard client={dashboardClient} contributions={dashboardContributions} />;
}
