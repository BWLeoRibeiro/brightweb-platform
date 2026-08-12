import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import { Button } from "@brightweblabs/ui";
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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <span className="eyebrow text-primary">{dictionary.kicker}</span>
          <h1 className="font-display text-[length:var(--text-ui-dashboard-title)] font-black leading-[var(--type-leading-110)] tracking-[var(--type-tracking-n025)] sm:text-[length:var(--text-ui-dashboard-title-lg)]">{clientProjectsDictionary.safeUi.myProjects}</h1>
          <p className="max-w-[42rem] text-body-lg leading-relaxed text-muted-foreground">{clientProjectsDictionary.safeUi.pageDescription}</p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/account">
            <ArrowLeft className="size-4" />
            {dictionary.back}
          </Link>
        </Button>
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
