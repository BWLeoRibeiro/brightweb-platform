import { AccountPage } from "@brightweblabs/core-auth";
import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card, StatusPill } from "@brightweblabs/ui";
import { Building2 } from "lucide-react";
import { getClientProject, listClientOrganizations, listClientProjects } from "../../client-access";
import type { ClientOrganizationMembership, ClientProjectsResult } from "../../client-contracts";
import { ClientProjectDetailPage } from "./project-detail-page";
import { ClientPortalHome } from "./client-portal-home";
import { clientProjectsDictionary } from "./dictionary";

async function loadClientPortalData(supabase: SupabaseClient): Promise<ClientProjectsResult> {
  const [items, organizations] = await Promise.all([
    listClientProjects(supabase),
    listClientOrganizations(supabase),
  ]);
  const ongoing = items.filter((project) => (
    !project.archivedAt
    && (project.status === "active" || project.status === "paused" || project.status === "blocked")
  ));
  const featuredProject = ongoing.length === 1 ? await getClientProject(supabase, ongoing[0]!.id) : null;
  return { items, organizations, featuredProject };
}

function ClientOrganizationMemberships({ organizations }: { organizations: ClientOrganizationMembership[] }) {
  return (
    <Card asChild variant="light">
      <article className="p-5 shadow-none">
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="size-3.5 text-muted-foreground" />
          <h2 className="text-label font-bold text-muted-foreground">{clientProjectsDictionary.profile.organizations}</h2>
        </div>
        {organizations.length === 0 ? (
          <p className="text-body text-muted-foreground">{clientProjectsDictionary.profile.noOrganizations}</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {organizations.map((organization) => (
              <li key={organization.id} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0 truncate text-body font-semibold">{organization.name}</span>
                <StatusPill token="--role-client" className="shrink-0">
                  {organization.role === "admin" ? clientProjectsDictionary.portal.organizationAdmin : clientProjectsDictionary.portal.organizationMember}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-meta text-muted-foreground">{clientProjectsDictionary.profile.readOnlyMemberships}</p>
      </article>
    </Card>
  );
}

/**
 * Ready-to-mount client account surfaces.
 *
 * Scaffolded apps mount routes as direct package re-exports, so the account
 * surface and route-param unwrapping live here rather than in app code that
 * every consumer would otherwise hand-write.
 */
export async function ClientAccountPage({
  internalProjectsHref = "/projetos",
}: {
  internalProjectsHref?: string;
} = {}) {
  const { role, supabase, user } = await requireServerPageAccess();
  if (role === "staff" || role === "admin") {
    return <AccountPage internalProjectsHref={internalProjectsHref} />;
  }
  const [profileResult, initialData] = await Promise.all([
    supabase.from("profiles").select("first_name").eq("user_id", user.id).maybeSingle<{ first_name: string | null }>(),
    loadClientPortalData(supabase as SupabaseClient).catch(() => null),
  ]);
  return <ClientPortalHome firstName={profileResult.data?.first_name ?? null} email={user.email ?? null} initialData={initialData} />;
}

export async function ClientProjectDetailRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ClientProjectDetailPage projectId={projectId} />;
}

export async function ClientProfilePage() {
  const { role, supabase } = await requireServerPageAccess();
  if (role === "staff" || role === "admin") return <AccountPage />;
  const organizations = await listClientOrganizations(supabase as SupabaseClient).catch(() => []);
  return (
    <AccountPage
      showWorkAccess={false}
      supplementaryContent={<ClientOrganizationMemberships organizations={organizations} />}
    />
  );
}
