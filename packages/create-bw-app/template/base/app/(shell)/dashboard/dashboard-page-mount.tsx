import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { DashboardLiveMount } from "./dashboard-live-mount";

export async function DashboardPageMount() {
  await requireServerPageRoleAccess(["admin", "staff"]);
  return <DashboardLiveMount />;
}
