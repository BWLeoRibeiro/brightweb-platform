import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { CrmOrganizationRoutePage } from "@brightweblabs/module-crm/ui";

export default async function OrganizationPage(props: Parameters<typeof CrmOrganizationRoutePage>[0]) {
  await requireServerPageRoleAccess(["admin", "staff"]);
  return <CrmOrganizationRoutePage {...props} />;
}
