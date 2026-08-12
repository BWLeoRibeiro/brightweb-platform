"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  Flag,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button, Card, DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, EmptyState, InitialsAvatar, StatusPill } from "@brightweblabs/ui";
import type {
  ClientOrganizationMembership,
  ClientProjectDetail,
  ClientProjectListItem,
  ClientProjectsResult,
} from "../../client-contracts";
import { clientProjectsDictionary } from "./dictionary";
import { ProjectListCard } from "./project-list-card";
import { ClientPortalHomeLoading } from "./projects-loading";
import { formatClientProjectDate, readStoredClientOrganizationFilter, resolveClientMetaPreview, resolveClientProjectDetailHref, storeClientOrganizationFilter } from "./shared";
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

function OrganizationIdentity({
  organizations,
  selectedOrganizationId,
  onSelect,
}: {
  organizations: ClientOrganizationMembership[];
  selectedOrganizationId: string;
  onSelect: (organizationId: string) => void;
}) {
  const multiple = organizations.length > 1;
  const selected = multiple
    ? organizations.find((organization) => organization.id === selectedOrganizationId) ?? null
    : organizations[0] ?? null;

  const identityCard = (interactive: boolean) => (
    <div className={`mt-2 flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-card)] border border-border/60 bg-[color:var(--project-surface-secondary)] p-4 text-left shadow-[var(--dashboard-shadow-sm)] ${interactive ? "transition-colors hover:border-border" : ""}`}>
      {selected ? (
        <InitialsAvatar label={selected.name} className="size-10 shrink-0" />
      ) : (
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><Building2 className="size-4" /></span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-title">{selected ? selected.name : clientProjectsDictionary.portal.allOrganizations}</span>
        {selected ? (
          <StatusPill token="--role-client" className="mt-1">{organizationRoleLabel(selected.role)}</StatusPill>
        ) : (
          <span className="block truncate text-meta text-muted-foreground">{organizations.map((organization) => organization.name).join(" · ")}</span>
        )}
      </span>
      {interactive ? <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
    </div>
  );

  return (
    <section className="w-full max-w-[34rem] lg:w-fit lg:min-w-[20rem] lg:justify-self-end" aria-labelledby="client-organization-label">
      <p id="client-organization-label" className="text-label text-muted-foreground lg:text-right">
        {multiple ? clientProjectsDictionary.portal.yourOrganizations : clientProjectsDictionary.portal.yourOrganization}
      </p>
      {multiple ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="block w-full rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {identityCard(true)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
            <DropdownMenuRadioGroup value={selected ? selected.id : "all"} onValueChange={onSelect}>
              <DropdownMenuRadioItem value="all" className="min-h-11">
                {clientProjectsDictionary.portal.allOrganizations}
              </DropdownMenuRadioItem>
              {organizations.map((organization) => (
                <DropdownMenuRadioItem key={organization.id} value={organization.id} className="min-h-11">
                  <span className="min-w-0">
                    <span className="block truncate text-body font-semibold">{organization.name}</span>
                    <span className="block text-meta text-muted-foreground">{organizationRoleLabel(organization.role)}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        identityCard(false)
      )}
    </section>
  );
}

function AccountAndSecurityFooter({ displayName, email }: { displayName: string; email: string | null }) {
  return (
    <footer className="rounded-[var(--radius-card)] border border-border/55 bg-background/55 p-5 shadow-[var(--dashboard-shadow-sm)] sm:p-6" aria-labelledby="client-account-footer-label">
      <div className="flex flex-wrap items-center gap-4">
        <InitialsAvatar label={displayName} className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p id="client-account-footer-label" className="flex items-center gap-1.5 text-label text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            {clientProjectsDictionary.portal.accountAndSecurity}
          </p>
          <p className="mt-0.5 truncate text-title">{displayName}</p>
          {email ? <p className="truncate text-meta text-muted-foreground">{email}</p> : null}
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/account/perfil">{clientProjectsDictionary.portal.openAccountAndSecurity}</Link>
        </Button>
      </div>
    </footer>
  );
}

function CurrentMetas({ metas, divider = true }: { metas: ClientProjectDetail["metas"]; divider?: boolean }) {
  const preview = resolveClientMetaPreview(metas);
  if (!preview) return null;

  return (
    <div className={divider ? "border-t border-border/60 pt-6" : undefined}>
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
  const hasProgress = progress !== null && progress > 0;
  const href = resolveClientProjectDetailHref(false, project.id);

  return (
    <Card asChild variant="elevated">
      <article className="overflow-hidden border-[color:var(--project-hero-border)] bg-background">
        <div className="grid lg:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)]">
          <div className="brand-panel relative flex flex-col overflow-hidden p-6 text-[color:var(--project-hero-foreground)] sm:p-8 lg:min-h-80 lg:p-10">
            <span aria-hidden className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-[color:var(--brand-accent)]/15 blur-3xl" />
            <div className="relative flex min-h-full flex-1 flex-col">
              <h3 className="text-[length:var(--text-ui-preview-card-title)] font-black leading-[var(--type-leading-110)] tracking-[var(--type-tracking-n025)] sm:text-[length:var(--text-ui-dashboard-title-lg)]">{project.name}</h3>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-meta text-[color:var(--project-hero-muted)]">
                {project.reference ? <span className="text-data font-semibold">{project.reference}</span> : null}
                <ProjectStatusBadge status={project.status} label={clientProjectsDictionary.portal.statusLabels[project.status]} size="small" />
              </div>
              {project.clientSummary ? <p className="mt-5 max-w-[36rem] text-body-lg leading-relaxed text-[color:var(--project-hero-muted)]">{project.clientSummary}</p> : null}
              <div className="mt-auto pt-7">
                <Button asChild size="lg" className="group min-h-11 min-w-44 justify-between gap-5 shadow-[var(--shadow-accent-control)]">
                  <Link href={href}>{clientProjectsDictionary.portal.openProject}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t border-border/65 bg-[color:var(--project-surface-secondary)] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
            {hasProgress ? (
              <div className="pb-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-label font-semibold text-muted-foreground">{clientProjectsDictionary.portal.progress}</p>
                    <p className="font-display mt-1 text-heading-2 font-black">{progress}%</p>
                  </div>
                  <span className="text-meta text-muted-foreground">{clientProjectsDictionary.portal.sharedMetas}</span>
                </div>
                <ProjectProgressBar ariaLabel={clientProjectsDictionary.portal.progress} percent={progress} className="mt-4" trackClassName="bg-border/70" fillClassName="bg-primary motion-reduce:transition-none" />
              </div>
            ) : null}

            <CurrentMetas metas={"metas" in project ? project.metas : project.metaPreview} divider={hasProgress} />

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

export function ClientPortalHome({ firstName, email = null, initialData = null }: { firstName: string | null; email?: string | null; initialData?: ClientProjectsResult | null }) {
  const [state, setState] = useState<PortalState>(() => initialData ? { status: "ready", data: initialData } : { status: "loading" });
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("all");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setSelectedOrganizationId(readStoredClientOrganizationFilter());
  }, []);

  const selectOrganization = (organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    storeClientOrganizationFilter(organizationId);
  };

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
    if (!data.organizations.some((organization) => organization.id === selectedOrganizationId)) return data.items;
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
  const focusedOrganization = organizations.length > 1
    ? organizations.find((organization) => organization.id === selectedOrganizationId) ?? null
    : null;
  const ongoingProjects = visibleProjects.filter(isOngoingProject);
  const featured = ongoingProjects.length === 1
    ? (featuredProject?.id === ongoingProjects[0]?.id ? featuredProject : ongoingProjects[0])
    : null;

  return (
    <div className="space-y-10 sm:space-y-14">
      <header className={organizations.length > 0 ? "grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end" : "space-y-7"}>
        <div className="max-w-[48rem]">
          <h1 className="font-display text-[length:var(--text-ui-dashboard-title)] font-black leading-[var(--type-leading-110)] tracking-[var(--type-tracking-n025)] sm:text-[length:var(--text-ui-dashboard-title-lg)]">
            {clientProjectsDictionary.portal.greetingPrefix}, <span style={{ color: "var(--accent)" }}>{displayName}</span>.
          </h1>
          <p className="mt-4 text-body-lg leading-relaxed text-muted-foreground">{clientProjectsDictionary.portal.homeDescription}</p>
        </div>
        {organizations.length > 0 ? (
          <OrganizationIdentity
            organizations={organizations}
            selectedOrganizationId={selectedOrganizationId}
            onSelect={selectOrganization}
          />
        ) : null}
      </header>

      {featured ? (
        <section aria-labelledby="client-featured-project-title" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="client-featured-project-title" className="text-heading-2 font-bold">{clientProjectsDictionary.portal.activeProject}</h2>
            <Link href="/account/projetos" className="inline-flex min-h-11 items-center gap-2 text-body font-bold text-primary hover:underline">{clientProjectsDictionary.portal.seeAllProjects}<ArrowRight className="size-4" /></Link>
          </div>
          <ProjectOverview project={featured} />
        </section>
      ) : ongoingProjects.length > 1 ? (
        <section aria-labelledby="client-projects-title" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="client-projects-title" className="text-heading-2 font-bold">{clientProjectsDictionary.portal.ongoingProjects}</h2>
            <Link href="/account/projetos" className="inline-flex min-h-11 items-center gap-2 text-body font-bold text-primary hover:underline">{clientProjectsDictionary.portal.seeAllProjects}<ArrowRight className="size-4" /></Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">{ongoingProjects.slice(0, 4).map((project) => (
            <ProjectListCard key={project.id} project={project} showOrganizations={!singleOrganization && !focusedOrganization} />
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

      <AccountAndSecurityFooter displayName={displayName} email={email} />
    </div>
  );
}
