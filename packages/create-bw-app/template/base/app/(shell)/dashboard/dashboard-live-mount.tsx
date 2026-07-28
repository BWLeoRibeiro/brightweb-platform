"use client";

import { AppDashboard, type DashboardDataClient } from "@brightweblabs/app-shell";
import { getStarterShellConfig } from "../../../config/shell";

async function getJson(path: string) {
  const response = await fetch(path);
  return response.json();
}

const dashboardClient: DashboardDataClient = {
  getProjects: () => getJson("/api/dashboard/projects"),
  getCrm: () => getJson("/api/dashboard/crm"),
  getTasks: () => getJson("/api/dashboard/tasks"),
};

export function DashboardLiveMount() {
  const { dashboardContributions } = getStarterShellConfig();
  return <AppDashboard client={dashboardClient} contributions={dashboardContributions} />;
}
