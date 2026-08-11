import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { DashboardPreviewClient } from "./dashboard-preview-client";

export default async function DashboardPreviewPage() {
  await requireServerPageRoleAccess(["admin", "staff"]);
  return <DashboardPreviewClient />;
}
