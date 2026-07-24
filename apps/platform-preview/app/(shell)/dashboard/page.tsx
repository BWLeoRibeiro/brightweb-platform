"use client";

import { AppDashboard } from "@brightweblabs/app-shell";
import { getStarterShellConfig } from "../../../config/shell";
import { dashboardDataClient, dashboardInitialData } from "./mock-data";

export default function DashboardPreviewPage() {
  const { dashboardContributions } = getStarterShellConfig();
  return <AppDashboard client={dashboardDataClient} contributions={dashboardContributions} initialData={dashboardInitialData} viewerFirstName="Leonel" />;
}
