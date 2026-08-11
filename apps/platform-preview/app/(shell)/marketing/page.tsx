import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { MarketingPage } from "@brightweblabs/module-marketing";

export default async function MarketingPreviewPage() {
  await requireServerPageRoleAccess(["admin", "staff"]);
  return <MarketingPage />;
}
