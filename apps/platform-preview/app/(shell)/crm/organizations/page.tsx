import { CrmOrganizationsPage } from "@brightweblabs/module-crm/ui";
import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";

export default async function OrganizationsPage() {
  await requireServerPageRoleAccess(["admin", "staff"]);
  return <CrmOrganizationsPage />;
}
