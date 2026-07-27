import { AccountPage } from "@brightweblabs/core-auth";
import { ClientProjectDetailPage } from "./project-detail-page";
import { ClientProjectsPreview } from "./projects-preview";

/**
 * Ready-to-mount client account surfaces.
 *
 * Scaffolded apps mount routes as direct package re-exports, so the composition
 * (account page + projects preview, and unwrapping route params) lives here
 * rather than in app code that every consumer would otherwise hand-write.
 */
export async function ClientAccountPage() {
  return <AccountPage projectsSlot={<ClientProjectsPreview />} />;
}

export async function ClientProjectDetailRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ClientProjectDetailPage projectId={projectId} />;
}
