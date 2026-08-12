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
} from "lucide-react";
import { Button, Card, DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, EmptyState, InitialsAvatar, StatusPill } from "@brightweblabs/ui";
import type {
  ClientOrganizationMembership,
  ClientProjectListItem,
  ClientProjectsResult,
} from "../../client-contracts";
import { clientProjectsDictionary } from "./dictionary";
import { ProjectListCard } from "./project-list-card";
import { ClientPortalHomeLoading } from "./projects-loading";
import {
  formatClientProjectDate,
  isClientProjectDateOverdue,
  readStoredClientOrganizationFilter,
  resolveClientProjectDetailHref,
  storeClientOrganizationFilter,
} from "./shared";

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

type UpcomingBriefingMeta = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  targetDate: string;
  delayed: boolean;
};

function buildUpcomingBriefing(projects: ClientProjectListItem[]): UpcomingBriefingMeta[] {
  return projects
    .flatMap((project) => project.metaPreview
      .filter((meta) => meta.status !== "achieved" && meta.targetDate)
      .map((meta) => ({
        id: `${project.id}:${meta.id}`,
        projectId: project.id,
        projectName: project.name,
        title: meta.title,
        targetDate: meta.targetDate as string,
        delayed: meta.status === "delayed" || isClientProjectDateOverdue(meta.targetDate),
      })))
    .sort((left, right) => left.targetDate.localeCompare(right.targetDate))
    .slice(0, 4);
}

function findNearestDelivery(projects: ClientProjectListItem[]) {
  return projects
    .filter((project): project is ClientProjectListItem & { targetDate: string } => Boolean(project.targetDate))
    .reduce<ClientProjectListItem & { targetDate: string } | null>((nearest, project) => (
      !nearest || project.targetDate.localeCompare(nearest.targetDate) < 0 ? project : nearest
    ), null);
}

function BriefingFact({ icon, label, value, detail, className }: { icon: React.ReactNode; label: string; value: string; detail: string | null; className: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="flex items-center gap-2 text-label" style={{ color: "var(--project-hero-muted)" }}>
        <span style={{ color: "var(--accent)" }}>{icon}</span>
        {label}
      </dt>
      <dd className="mt-2 truncate text-title">{value}</dd>
      {detail ? <dd className="mt-0.5 truncate text-meta" style={{ color: "var(--project-hero-muted)" }}>{detail}</dd> : null}
    </div>
  );
}

function UpcomingBriefing({ items }: { items: UpcomingBriefingMeta[] }) {
  return (
    <aside className="min-w-0 rounded-[var(--radius-card)] border border-border/55 bg-[color:var(--project-surface-secondary)] p-5 shadow-[var(--dashboard-shadow-sm)] lg:col-start-2 lg:row-start-1" aria-labelledby="client-upcoming-title">
      <p className="text-label text-primary">{clientProjectsDictionary.portal.upNextEyebrow}</p>
      <h3 id="client-upcoming-title" className="mt-1 text-heading-3 font-bold">{clientProjectsDictionary.portal.upNext}</h3>
      <p className="mt-1 text-meta text-muted-foreground">{clientProjectsDictionary.portal.upNextDescription}</p>
      {items.length > 0 ? (
        <ol className="portal-scroll -mx-1 mt-5 flex min-w-0 max-w-full gap-3 overflow-x-auto px-1 pb-2 lg:mx-0 lg:block lg:divide-y lg:divide-border/55 lg:overflow-visible lg:px-0 lg:pb-0">
          {items.map((item) => (
            <li key={item.id} className="min-w-[13rem] rounded-xl border border-border/55 bg-background/65 lg:min-w-0 lg:rounded-none lg:border-0 lg:bg-transparent">
              <Link
                href={resolveClientProjectDetailHref(false, item.projectId)}
                className="group/next block min-h-11 rounded-xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:-mx-2 lg:rounded-lg lg:px-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <time dateTime={item.targetDate} className={`text-data text-micro font-bold ${item.delayed ? "text-[color:var(--project-health-off-track)]" : "text-primary"}`}>
                    {formatClientProjectDate(item.targetDate)}
                  </time>
                  <ArrowRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover/next:translate-x-0.5 motion-reduce:transition-none motion-reduce:transform-none" />
                </div>
                <p className="mt-1 text-body font-bold leading-snug">{item.title}</p>
                <p className="mt-0.5 truncate text-meta text-muted-foreground">{item.projectName}</p>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-border/70 p-4 text-body text-muted-foreground">
          {clientProjectsDictionary.portal.noUpcomingMetas}
        </p>
      )}
    </aside>
  );
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

  const identity = (
    <>
      {selected ? (
        <InitialsAvatar label={selected.name} tone="inverse" className="size-10 shrink-0" />
      ) : (
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><Building2 className="size-4" /></span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-title">{selected ? selected.name : clientProjectsDictionary.portal.allOrganizations}</span>
        {selected ? (
          <StatusPill token="--role-client" className="mt-1">{organizationRoleLabel(selected.role)}</StatusPill>
        ) : (
          <span className="block truncate text-meta" style={{ color: "var(--project-hero-muted)" }}>{organizations.map((organization) => organization.name).join(" · ")}</span>
        )}
      </span>
    </>
  );
  const identityCardClassName = "mt-2 flex h-20 w-full items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-surface-raised)] p-4 text-left text-[color:var(--project-hero-foreground)] shadow-none";

  return (
    <section className="min-w-0 w-full lg:w-80 lg:justify-self-end" aria-labelledby="client-organization-label">
      <p id="client-organization-label" className="text-label lg:text-right" style={{ color: "var(--project-hero-muted)" }}>
        {multiple ? clientProjectsDictionary.portal.yourOrganizations : clientProjectsDictionary.portal.yourOrganization}
      </p>
      {multiple ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={`${identityCardClassName} group min-w-0 transition-[border-color,box-shadow] hover:border-[color:var(--accent)] focus-visible:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] motion-reduce:transition-none`}>
              {identity}
              <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" style={{ color: "var(--project-hero-muted)" }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-[var(--radix-dropdown-menu-trigger-width)] max-w-[calc(100vw-2rem)]">
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
        <div className={identityCardClassName}>{identity}</div>
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
  const ongoingProjects = useMemo(() => visibleProjects.filter(isOngoingProject), [visibleProjects]);
  const upcomingBriefing = useMemo(() => buildUpcomingBriefing(ongoingProjects), [ongoingProjects]);
  const nearestDelivery = useMemo(() => findNearestDelivery(ongoingProjects), [ongoingProjects]);
  const displayName = firstName?.trim() || clientProjectsDictionary.portal.clientFallbackName;

  if (state.status === "loading") return <ClientPortalHomeLoading />;
  if (state.status === "error") return (
    <div className="mx-auto max-w-[36rem] rounded-2xl border border-destructive/25 bg-destructive/10 p-6 text-center">
      <p className="text-body text-destructive">{clientProjectsDictionary.portal.loadError}</p>
      <Button type="button" variant="outline" className="mt-4 gap-2" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className="size-4" />{clientProjectsDictionary.safeUi.retry}</Button>
    </div>
  );

  const { organizations } = state.data;
  const singleOrganization = organizations.length === 1 ? organizations[0] : null;
  const focusedOrganization = organizations.length > 1
    ? organizations.find((organization) => organization.id === selectedOrganizationId) ?? null
    : null;
  const nextMeta = upcomingBriefing[0] ?? null;
  const deliveryOverdue = nearestDelivery ? isClientProjectDateOverdue(nearestDelivery.targetDate) : false;

  return (
    <div className="space-y-10 sm:space-y-14">
      <header className="brand-panel relative overflow-hidden rounded-[var(--radius-panel)] p-6 text-[color:var(--project-hero-foreground)] sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full opacity-100 blur-3xl dark:opacity-40" style={{ background: "var(--dashboard-hero-glow)" }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "var(--dashboard-hero-highlight)" }} />
        <div className={organizations.length > 0 ? "relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end" : "relative space-y-7"}>
          <div className="max-w-[48rem]">
            <h1 className="font-display text-[length:var(--text-ui-dashboard-title)] font-black leading-[var(--type-leading-110)] tracking-[var(--type-tracking-n025)] sm:text-[length:var(--text-ui-dashboard-title-lg)]">
              {clientProjectsDictionary.portal.greetingPrefix}, <span style={{ color: "var(--accent)" }}>{displayName}</span>.
            </h1>
            <p className="mt-4 text-body-lg leading-relaxed" style={{ color: "var(--project-hero-muted)" }}>{clientProjectsDictionary.portal.homeDescription}</p>
          </div>
          {organizations.length > 0 ? (
            <OrganizationIdentity
              organizations={organizations}
              selectedOrganizationId={selectedOrganizationId}
              onSelect={selectOrganization}
            />
          ) : null}
        </div>
        <dl className="relative mt-8 grid grid-cols-2 border-t border-[color:var(--project-hero-border)] pt-5 sm:grid-cols-3">
          <BriefingFact
            icon={<BriefcaseBusiness aria-hidden className="size-4" />}
            label={clientProjectsDictionary.portal.workInProgress}
            value={clientProjectsDictionary.portal.activeProjectsCount(ongoingProjects.length)}
            detail={focusedOrganization?.name ?? singleOrganization?.name ?? (organizations.length > 1 ? clientProjectsDictionary.portal.allOrganizations : null)}
            className="col-span-2 border-b border-[color:var(--project-hero-border)] pb-4 sm:col-span-1 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5"
          />
          <BriefingFact
            icon={<Flag aria-hidden className="size-4" />}
            label={nextMeta?.delayed ? clientProjectsDictionary.portal.delayedMeta : clientProjectsDictionary.portal.nextSharedMeta}
            value={nextMeta?.title ?? clientProjectsDictionary.portal.noScheduledMetas}
            detail={nextMeta ? `${nextMeta.projectName} · ${formatClientProjectDate(nextMeta.targetDate)}` : null}
            className="border-r border-[color:var(--project-hero-border)] pr-4 pt-4 sm:px-5 sm:pt-0"
          />
          <BriefingFact
            icon={<CalendarDays aria-hidden className="size-4" />}
            label={deliveryOverdue ? clientProjectsDictionary.portal.delayedDelivery : clientProjectsDictionary.portal.nextDelivery}
            value={nearestDelivery?.name ?? clientProjectsDictionary.portal.noScheduledDelivery}
            detail={nearestDelivery ? formatClientProjectDate(nearestDelivery.targetDate) : null}
            className="pl-4 pt-4 sm:pl-5 sm:pt-0"
          />
        </dl>
      </header>

      {ongoingProjects.length > 0 ? (
        <section aria-labelledby="client-projects-title" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="client-projects-title" className="text-heading-2 font-bold">
              {ongoingProjects.length === 1 ? clientProjectsDictionary.portal.activeProject : clientProjectsDictionary.portal.ongoingProjects}
            </h2>
            <Link href="/account/projetos" className="inline-flex min-h-11 items-center gap-2 text-body font-bold text-primary hover:underline">{clientProjectsDictionary.portal.seeAllProjects}<ArrowRight className="size-4" /></Link>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <UpcomingBriefing items={upcomingBriefing} />
            <div className={`grid gap-4 lg:col-start-1 lg:row-start-1 ${ongoingProjects.length > 1 ? "md:grid-cols-2" : ""}`}>{ongoingProjects.slice(0, 4).map((project) => (
              <ProjectListCard key={project.id} project={project} showOrganizations={!singleOrganization && !focusedOrganization} headingLevel="h3" />
            ))}</div>
          </div>
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
