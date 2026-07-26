"use client";

import { AppDashboard, type DashboardDataClient } from "@brightweblabs/app-shell";
import { getStarterShellConfig } from "../../../config/shell";

async function getJson(path: string) {
  const response = await fetch(path);
  return response.json();
}

const dashboardClient: DashboardDataClient = {
  getOverview: () => Promise.reject(new Error("No aggregate dashboard endpoint configured.")),
  getProjects: () => getJson("/api/projects/stats"),
  getCrm: () => getJson("/api/crm/stats"),
  getTasks: () => Promise.reject(new Error("No task dashboard endpoint configured.")),
};

export function DashboardLiveMount() {
  const { dashboardContributions } = getStarterShellConfig();
  return <AppDashboard client={dashboardClient} contributions={dashboardContributions} />;
}
