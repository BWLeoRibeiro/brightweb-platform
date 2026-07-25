import { ClientProjectDetailPage } from "@brightweblabs/module-projects";

export default async function AccountProjectDetailRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ClientProjectDetailPage projectId={projectId} />;
}
