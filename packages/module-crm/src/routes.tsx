import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { CrmDashboard } from "./ui/dashboard";
import { CrmOrganizationPage } from "./ui/organization-page";
import { CrmOrganizationsPage } from "./ui/organizations-page";
import { CrmReportPage } from "./ui/report";

async function requireCrmPageAccess() {
  await requireServerPageRoleAccess(["admin", "staff"]);
}

export async function CrmDashboardRoutePage() {
  await requireCrmPageAccess();
  return <CrmDashboard />;
}

export async function CrmOrganizationsRoutePage() {
  await requireCrmPageAccess();
  return <CrmOrganizationsPage />;
}

export async function CrmOrganizationRoutePage({ params }: { params: Promise<{ id: string }> }) {
  await requireCrmPageAccess();
  const { id } = await params;
  return <CrmOrganizationPage organizationId={id} />;
}

export async function CrmReportRoutePage() {
  await requireCrmPageAccess();
  return <CrmReportPage />;
}
