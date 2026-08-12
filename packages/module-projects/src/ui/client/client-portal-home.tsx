"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Flag,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button, Card, EmptyState, InitialsAvatar, SectionHeading, StatusPill } from "@brightweblabs/ui";
import type {
  ClientOrganizationMembership,
  ClientProjectDetail,
  ClientProjectListItem,
  ClientProjectsResult,
} from "../../client-contracts";
import { clientProjectsDictionary } from "./dictionary";
import { ProjectListCard } from "./project-list-card";
import { ClientPortalHomeLoading } from "./projects-loading";
import { formatClientProjectDate, resolveClientMetaPreview, resolveClientProjectDetailHref } from "./shared";
import { ProjectStatusBadge } from "../project-state-badge";
import { ProjectProgressBar } from "../shared/project-progress";

type PortalState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ClientProjectsResult };

const ONGOING_PROJECT_STATUSES = new Set(["active", "paused", "blocked"]);

function isOngoingProject(project: Pick<ClientProjectListItem, "status" | "archivedAt">) {
  return !project.archivedAt && ONGOING_PROJECT_STATUSES.has(project.status);
}

function organizationRoleLabel(role: ClientOrganizationMembership["role"]) {
  return role === "admin" ? clientProjectsDictionary.portal.organizationAdmin : clientProjectsDictionary.portal.organizationMember;
}

function OrganizationIdentity({ organization }: { organization: ClientOrganizationMembership }) {
  return (
    <section className="border-y border-border/65 py-4 sm:border-y-0 sm:py-0" aria-labelledby="client-organization-label">
      <p id="client-organization-label" className="text-label text-muted-foreground">
        {clientProjectsDictionary.portal.yourOrganization}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <InitialsAvatar label={organization.name} className="size-9" />
        <span className="text-body font-bold">{organization.name}</span>
        <StatusPill token="--role-client">
          {organizationRoleLabel(organization.role)}
        </StatusPill>
      </div>
    </section>
  );
}

function AccountAndSecurityFooter() {
  return (
    <footer className="border-t border-border/65 pt-6">
      <SectionHeading
        icon={ShieldCheck}
        title={clientProjectsDictionary.portal.accountAndSecurity}
        subtitle={clientProjectsDictionary.portal.accountAndSecurityDescription}
        action={(
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/account/perfil">{clientProjectsDictionary.portal.openAccountAndSecurity}</Link>
          </Button>
        )}
      />
    </footer>
  );
}

function CurrentMetas({ metas }: { metas: ClientProjectDetail["metas"] }) {
  const preview = resolveClientMetaPreview(metas);
  if (!preview) return null;

  return (
    <div className="border-t border-border/60 pt-6">
      <p className="text-label font-semibold text-muted-foreground">{preview.label}</p>
      <ul className="mt-3 space-y-3">
        {preview.metas.map((meta) => (
          <li key={meta.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Flag className="size-4" /></span>
            <span className="min-w-0 text-body font-bold">{meta.title}</span>
            {meta.targetDate ? <span className="text-data text-meta text-muted-foreground">{formatClientProjectDate(meta.targetDate)}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProjectOverview({ project }: { project: ClientProjectDetail | ClientProjectListItem }) {
  const progress = project.progress.percent;
  const href = resolveClientProjectDetailHref(false, project.id);

  return (
    <Card asChild variant="light">
      <article className="overflow-hidden border-border/70 bg-background/80 shadow-none">
        <div className="grid lg:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)]">
          <div className="flex min-h-80 flex-col p-6 sm:p-8">
            <p className="eyebrow text-primary">{clientProjectsDictionary.portal.activeProject}</p>
            <h2 className="mt-4 text-heading-1 sm:text-[length:var(--text-ui-dashboard-title-lg)]">{project.name}</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-meta text-muted-foreground">
              {project.reference ? <span className="text-data font-semibold">{project.reference}</span> : null}
              <ProjectStatusBadge status={project.status} label={clientProjectsDictionary.portal.statusLabels[project.status]} size="small" />
            </div>
            {project.clientSummary ? <p className="mt-6 max-w-[36rem] text-body-lg text-muted-foreground">{project.clientSummary}</p> : null}
            <div className="mt-auto pt-8">
              <Button asChild size="lg" className="group min-h-11 min-w-40 justify-between gap-5">
                <Link href={href}>{clientProjectsDictionary.portal.openProject}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></Link>
              </Button>
            </div>
          </div>

          <div className="border-t border-border/65 bg-muted/20 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="pb-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-label font-semibold text-muted-foreground">{clientProjectsDictionary.portal.progress}</p>
                  <p className="font-display mt-1 text-heading-2 font-black">{progress ?? 0}%</p>
                </div>
                <span className="text-meta text-muted-foreground">{clientProjectsDictionary.portal.sharedMetas}</span>
              </div>
              <ProjectProgressBar ariaLabel={clientProjectsDictionary.portal.progress} percent={progress} className="mt-4" trackClassName="bg-border/70" fillClassName="bg-primary motion-reduce:transition-none" />
            </div>

            <CurrentMetas metas={"metas" in project ? project.metas : project.metaPreview} />

            <dl className="mt-6 divide-y divide-border/60 border-t border-border/60">
              {project.targetDate ? (
                <div className="grid grid-cols-[2.5rem_1fr] items-center gap-3 py-5">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[color:var(--project-ui-color-37)] text-[color:var(--project-state-completed-strong)]"><CalendarDays className="size-4" /></span>
                  <div><dt className="text-micro font-semibold text-muted-foreground">{clientProjectsDictionary.portal.targetDate}</dt><dd className="text-data mt-0.5 text-body font-bold">{formatClientProjectDate(project.targetDate)}</dd></div>
                </div>
              ) : null}
              {project.clientContact ? (
                <div className="grid grid-cols-[2.5rem_1fr] items-center gap-3 py-5">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><UserRound className="size-4" /></span>
                  <div><dt className="text-micro font-semibold text-muted-foreground">{clientProjectsDictionary.portal.responsible}</dt><dd className="mt-0.5 text-body font-bold">{project.clientContact.label}</dd></div>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </article>
    </Card>
  );
}

export function ClientPortalHome({ firstName, initialData = null }: { firstName: string | null; initialData?: ClientProjectsResult | null }) {
  const [state, setState] = useState<PortalState>(() => initialData ? { status: "ready", data: initialData } : { status: "loading" });
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("all");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (reloadKey === 0 && initialData) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch("/api/account/projects", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load client portal");
        const payload = await response.json() as ClientProjectsResult;
        if (!Array.isArray(payload.items) || !Array.isArray(payload.organizations)) throw new Error("Invalid client portal response");
        setState({ status: "ready", data: payload });
      })
      .catch((cause) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, [initialData, reloadKey]);

  const data = state.status === "ready" ? state.data : null;
  const visibleProjects = useMemo(() => {
    if (!data || selectedOrganizationId === "all") return data?.items ?? [];
    return data.items.filter((project) => project.organizations.some((organization) => organization.id === selectedOrganizationId));
  }, [data, selectedOrganizationId]);
  const displayName = firstName?.trim() || clientProjectsDictionary.portal.clientFallbackName;

  if (state.status === "loading") return <ClientPortalHomeLoading />;
  if (state.status === "error") return (
    <div className="mx-auto max-w-[36rem] rounded-2xl border border-destructive/25 bg-destructive/10 p-6 text-center">
      <p className="text-body text-destructive">{clientProjectsDictionary.portal.loadError}</p>
      <Button type="button" variant="outline" className="mt-4 gap-2" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className="size-4" />{clientProjectsDictionary.safeUi.retry}</Button>
    </div>
  );

  const { organizations, featuredProject } = state.data;
  const singleOrganization = organizations.length === 1 ? organizations[0] : null;
  const ongoingProjects = visibleProjects.filter(isOngoingProject);
  const featured = ongoingProjects.length === 1
    ? (featuredProject?.id === ongoingProjects[0]?.id ? featuredProject : ongoingProjects[0])
    : null;

  return (
    <div className="space-y-9 sm:space-y-12">
      <header className="space-y-6">
        <div>
          <h1 className="text-heading-1">{clientProjectsDictionary.portal.greeting(displayName)}</h1>
          <p className="mt-3 text-body-lg text-muted-foreground">{clientProjectsDictionary.portal.homeDescription}</p>
        </div>
        {singleOrganization ? <OrganizationIdentity organization={singleOrganization} /> : null}
      </header>

      {organizations.length > 1 ? (
        <section aria-labelledby="client-organizations-title" className="space-y-4">
          <div className="flex items-center gap-2"><Building2 className="size-4 text-primary" /><h2 id="client-organizations-title" className="text-title">{clientProjectsDictionary.portal.myOrganizations}</h2></div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            <button type="button" aria-pressed={selectedOrganizationId === "all"} onClick={() => setSelectedOrganizationId("all")} className={`min-w-fit rounded-xl border px-4 py-3 text-left transition-colors ${selectedOrganizationId === "all" ? "border-primary bg-primary/10" : "border-border/70 bg-background/70 hover:border-border"}`}><span className="text-body font-bold">{clientProjectsDictionary.portal.allOrganizations}</span></button>
            {organizations.map((organization) => (
              <button key={organization.id} type="button" aria-pressed={selectedOrganizationId === organization.id} onClick={() => setSelectedOrganizationId(organization.id)} className={`min-w-[13rem] rounded-xl border px-4 py-3 text-left transition-colors ${selectedOrganizationId === organization.id ? "border-primary bg-primary/10" : "border-border/70 bg-background/70 hover:border-border"}`}>
                <span className="block text-body font-bold">{organization.name}</span><span className="mt-1 block text-meta text-muted-foreground">{organizationRoleLabel(organization.role)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {featured ? <ProjectOverview project={featured} /> : ongoingProjects.length > 1 ? (
        <section aria-labelledby="client-projects-title" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="eyebrow text-primary">{clientProjectsDictionary.portal.currentWork}</p><h2 id="client-projects-title" className="mt-1 text-heading-2 font-bold">{clientProjectsDictionary.portal.ongoingProjects}</h2></div>
            <Link href="/account/projetos" className="inline-flex min-h-11 items-center gap-2 text-body font-bold text-primary hover:underline">{clientProjectsDictionary.portal.seeAllProjects}<ArrowRight className="size-4" /></Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">{ongoingProjects.slice(0, 4).map((project) => (
            <ProjectListCard key={project.id} project={project} showOrganizations={!singleOrganization} />
          ))}</div>
        </section>
      ) : (
        <Card asChild variant="light">
          <section>
            <EmptyState
              icon={BriefcaseBusiness}
              title={clientProjectsDictionary.portal.noOngoingProjects}
              hint={clientProjectsDictionary.portal.noOngoingProjectsDescription}
              action={<Button asChild variant="outline"><Link href="/account/projetos">{clientProjectsDictionary.portal.seeProjectHistory}</Link></Button>}
            />
          </section>
        </Card>
      )}

      <AccountAndSecurityFooter />
    </div>
  );
}
