import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
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
  const dictionary = clientProjectsDictionary.list;

  return (
      <section className="space-y-8">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="eyebrow text-primary">{dictionary.kicker}</span>
              <h1 className="font-display text-heading-1 font-black leading-tight">{clientProjectsDictionary.safeUi.myProjects}</h1>
              <p className="text-body text-muted-foreground">{clientProjectsDictionary.safeUi.pageDescription}</p>
            </div>
            <Link href="/account" className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-body font-semibold transition-colors hover:bg-background">
              <ArrowLeft className="size-4" />
              {dictionary.back}
            </Link>
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
