import { CrmReportPage } from "@brightweblabs/module-crm/ui";
import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";

export default async function CrmReportPreviewPage() {
  await requireServerPageRoleAccess(["admin", "staff"]);
  return <CrmReportPage />;
}
