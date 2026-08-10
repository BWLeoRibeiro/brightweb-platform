import { CrmOrganizationPage } from "./organization-page";

export async function CrmOrganizationRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CrmOrganizationPage organizationId={id} />;
}
