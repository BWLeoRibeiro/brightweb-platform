import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listClientProjects } from "../../client-access";
import { ClientProjectsListClient } from "./projects-list-client";

async function ClientProjectsListPageWithInternalHref(internalProjectsHref: string) {
  await connection();
  const { role, supabase } = await requireServerPageAccess();
  if (role === "staff" || role === "admin") redirect(internalProjectsHref);
  const initialProjects = await listClientProjects(supabase as SupabaseClient).catch(() => null);

  return <ClientProjectsListClient initialProjects={initialProjects} />;
}

export async function ClientProjectsListPage() {
  return ClientProjectsListPageWithInternalHref("/projetos");
}

export async function ClientProjectsPreviewListPage() {
  return ClientProjectsListPageWithInternalHref("/projects");
}
