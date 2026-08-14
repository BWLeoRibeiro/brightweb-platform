import { CrmDashboard } from "@brightweblabs/module-crm/ui";
import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";

export default async function CrmPage() {
  await requireServerPageRoleAccess(["admin", "staff"]);
  return <CrmDashboard />;
}
