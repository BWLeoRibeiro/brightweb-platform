import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listClientProjects } from "../../client-access";
import { clientProjectsDictionary } from "./dictionary";
import { ClientProjectsListClient } from "./projects-list-client";

async function ClientProjectsListPageWithInternalHref(internalProjectsHref: string) {
  await connection();
  const { role, supabase } = await requireServerPageAccess();
  if (role === "staff" || role === "admin") redirect(internalProjectsHref);
  const initialProjects = await listClientProjects(supabase as SupabaseClient).catch(() => null);

  return (
    <section className="space-y-8">
      <header className="max-w-[48rem] space-y-2">
        <h1 className="font-display text-[length:var(--text-ui-dashboard-title)] font-black leading-[var(--type-leading-110)] tracking-[var(--type-tracking-n025)] sm:text-[length:var(--text-ui-dashboard-title-lg)]">{clientProjectsDictionary.safeUi.myProjects}</h1>
        <p className="max-w-[42rem] text-body-lg leading-relaxed text-muted-foreground">{clientProjectsDictionary.safeUi.pageDescription}</p>
      </header>
      <ClientProjectsListClient initialProjects={initialProjects} />
    </section>
  );
}

export async function ClientProjectsListPage() {
  return ClientProjectsListPageWithInternalHref("/projetos");
}

export async function ClientProjectsPreviewListPage() {
  return ClientProjectsListPageWithInternalHref("/projects");
}
