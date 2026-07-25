import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight, FolderKanban } from "lucide-react";
import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import { listAccountProjects } from "../../account-projects";
import { clientProjectsDictionary } from "./dictionary";
import { ProjectListCard } from "./project-list-card";

export async function ClientProjectsListPage() {
  await connection();
  const { profileId, role, supabase } = await requireServerPageAccess();
  const isStaff = role === "staff" || role === "admin";
  const projects = await listAccountProjects(supabase, profileId, { limit: 40 });
  const dictionary = clientProjectsDictionary.list;
  const { activeCount, onTrackCount } = projects.items.reduce(
    (counts, project) => {
      if (project.status === "active") counts.activeCount += 1;
      if (project.health === "on_track") counts.onTrackCount += 1;
      return counts;
    },
    { activeCount: 0, onTrackCount: 0 },
  );

  // TODO(projects-realtime): mount the account projects refresher when the app shell supports it.
  return (
    <section
      className="client-projects-panel panel preview-glass-card"
      style={{
        borderTopColor: "var(--project-client-accent)",
        borderTopWidth: "3px",
      }}
    >
      <div className="panel-inner space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="eyebrow">{dictionary.kicker}</span>
            <h1 className="text-2xl font-semibold leading-tight">{dictionary.title}</h1>
            <p className="text-sm text-muted-foreground">{dictionary.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/account"
              className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-sm font-semibold transition-colors hover:bg-background motion-reduce:transition-none"
            >
              <ArrowLeft className="size-4" />
              {dictionary.back}
            </Link>
            {isStaff ? (
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 motion-reduce:transition-none"
              >
                {dictionary.fullModule}
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
          </div>
        </header>

        {projects.items.length > 0 ? (
          <div className="flex items-stretch gap-0 overflow-hidden rounded-xl border border-border/60 bg-background/40">
            <div className="flex-1 border-r border-border/60 px-4 py-3 text-center">
              <p className="font-display text-2xl font-bold leading-none tabular-nums">
                {projects.items.length}
              </p>
              <p className="mt-1.5 text-ui-label uppercase tracking-wide text-muted-foreground">
                {dictionary.total}
              </p>
            </div>
            <div className="flex-1 border-r border-border/60 px-4 py-3 text-center">
              <p
                className="font-display text-2xl font-bold leading-none tabular-nums"
                style={{ color: "var(--project-health-on-track)" }}
              >
                {activeCount}
              </p>
              <p className="mt-1.5 text-ui-label uppercase tracking-wide text-muted-foreground">
                {dictionary.active}
              </p>
            </div>
            <div className="flex-1 px-4 py-3 text-center">
              <p
                className="font-display text-2xl font-bold leading-none tabular-nums"
                style={{ color: "var(--project-health-on-track)" }}
              >
                {onTrackCount}
              </p>
              <p className="mt-1.5 text-ui-label uppercase tracking-wide text-muted-foreground">
                {dictionary.onTime}
              </p>
            </div>
          </div>
        ) : null}

        {projects.schemaMissing ? (
          <p className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
            {dictionary.schemaMissing}
          </p>
        ) : null}

        {projects.error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {dictionary.loadError} {projects.error}
          </p>
        ) : null}

        {!projects.schemaMissing && !projects.error && projects.items.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-10 text-center">
            <FolderKanban className="mx-auto mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{dictionary.empty}</p>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {projects.items.map((project) => (
            <ProjectListCard key={project.id} project={project} isStaff={isStaff} />
          ))}
        </div>
      </div>
    </section>
  );
}
