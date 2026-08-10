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
  getTasks: (options) => {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.pageSize) params.set("pageSize", String(options.pageSize));
    const query = params.size ? `?${params.toString()}` : "";
    return getJson(`/api/dashboard/tasks${query}`, options?.signal);
  },
};

export function DashboardLiveMount() {
  const { dashboardContributions } = getStarterShellConfig();
  return <AppDashboard client={dashboardClient} contributions={dashboardContributions} />;
}
