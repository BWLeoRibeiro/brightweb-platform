import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FolderKanban } from "lucide-react";
import { listClientProjects } from "../../client-access";
import { clientProjectsDictionary } from "./dictionary";
import { ClientProjectsListClient } from "./projects-list-client";

async function ClientProjectsListPageWithInternalHref(internalProjectsHref: string) {
  await connection();
  const { role, supabase } = await requireServerPageAccess();
  if (role === "staff" || role === "admin") redirect(internalProjectsHref);
  const initialProjects = await listClientProjects(supabase as SupabaseClient).catch(() => null);

  return (
    <section className="space-y-6 sm:space-y-8">
      <header className="brand-panel relative overflow-hidden rounded-[var(--radius-panel)] p-6 text-[color:var(--project-hero-foreground)] md:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full opacity-100 blur-3xl dark:opacity-40" style={{ background: "var(--dashboard-hero-glow)" }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "var(--dashboard-hero-highlight)" }} />
        <div className="relative max-w-[48rem]">
          <p className="inline-flex items-center gap-2 text-label font-semibold" style={{ color: "var(--project-hero-muted)" }}>
            <FolderKanban aria-hidden className="size-3.5" style={{ color: "var(--accent)" }} />
            {clientProjectsDictionary.safeUi.portfolioEyebrow}
          </p>
          <h1 className="font-display mt-4 text-[length:var(--text-ui-dashboard-title)] font-black leading-[var(--type-leading-110)] tracking-[var(--type-tracking-n025)] sm:text-[length:var(--text-ui-dashboard-title-lg)]">{clientProjectsDictionary.safeUi.myProjects}</h1>
          <p className="mt-3 max-w-[42rem] text-body-lg leading-relaxed" style={{ color: "var(--project-hero-muted)" }}>{clientProjectsDictionary.safeUi.pageDescription}</p>
        </div>
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
