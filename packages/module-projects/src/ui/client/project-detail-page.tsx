import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientProject } from "../../client-access";
import { ClientProjectDetailClient } from "./project-detail-client";

export async function ClientProjectDetailPage({ projectId, internalProjectsHref = "/projetos" }: { projectId: string; internalProjectsHref?: string }) {
  await connection();
  const { role, supabase } = await requireServerPageAccess();
  if (role === "staff" || role === "admin") redirect(`${internalProjectsHref}/${encodeURIComponent(projectId)}`);
  const initialProject = await getClientProject(supabase as SupabaseClient, projectId).catch(() => undefined);
  return <ClientProjectDetailClient projectId={projectId} initialProject={initialProject} />;
}
