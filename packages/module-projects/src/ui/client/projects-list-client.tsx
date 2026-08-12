"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, FolderKanban } from "lucide-react";
import { PillTabs } from "@brightweblabs/app-shell";
import { Button, Card, EmptyState, SearchField, SelectControl } from "@brightweblabs/ui";
import type { ClientProjectListItem, ClientProjectsResult } from "../../client-contracts";
import { ProjectListCard } from "./project-list-card";
import { ClientProjectsListLoading } from "./projects-loading";
import { clientProjectsDictionary } from "./dictionary";
import { readStoredClientOrganizationFilter, storeClientOrganizationFilter } from "./shared";

export type ClientProjectGroup = "ongoing" | "completed" | "all";

export function matchesClientProjectGroup(
  project: Pick<ClientProjectListItem, "status" | "archivedAt">,
  group: ClientProjectGroup,
) {
  if (group === "all") return true;
  if (project.archivedAt) return false;
  return group === "completed"
    ? project.status === "completed"
    : ["active", "paused", "blocked"].includes(project.status);
}

export function matchesClientProjectOrganization(
  project: Pick<ClientProjectListItem, "organizations">,
  organizationId: string,
) {
  return organizationId === "all"
    || project.organizations.some((organization) => organization.id === organizationId);
}

const GROUPS: Array<{ value: ClientProjectGroup; label: string }> = [
  { value: "ongoing", label: clientProjectsDictionary.safeUi.ongoingProjects },
  { value: "completed", label: clientProjectsDictionary.safeUi.completedProjects },
  { value: "all", label: clientProjectsDictionary.safeUi.allProjects },
];

function ClientProjectsPortfolioHeader({
  organizations,
  activeOrganizationId,
  activeCount,
  totalCount,
  onSelectOrganization,
}: {
  organizations: Array<{ id: string; name: string }>;
  activeOrganizationId: string;
  activeCount: number;
  totalCount: number;
  onSelectOrganization: (organizationId: string) => void;
}) {
  const selectedOrganization = organizations.find((organization) => organization.id === activeOrganizationId) ?? null;
  const scopeLabel = selectedOrganization?.name ?? clientProjectsDictionary.portal.allOrganizations;

  return (
    <header className="brand-panel relative overflow-hidden rounded-[var(--radius-panel)] p-6 text-[color:var(--project-hero-foreground)] md:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full opacity-100 blur-3xl dark:opacity-40" style={{ background: "var(--dashboard-hero-glow)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "var(--dashboard-hero-highlight)" }} />
      <div className={`relative grid gap-7 ${organizations.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end" : ""}`}>
        <div className="max-w-[48rem]">
          <p className="inline-flex items-center gap-2 text-label font-semibold" style={{ color: "var(--project-hero-muted)" }}>
            <FolderKanban aria-hidden className="size-3.5" style={{ color: "var(--accent)" }} />
            {clientProjectsDictionary.safeUi.portfolioEyebrow}
          </p>
          <h1 className="font-display mt-4 text-[length:var(--text-ui-dashboard-title)] font-black leading-[var(--type-leading-110)] tracking-[var(--type-tracking-n025)] sm:text-[length:var(--text-ui-dashboard-title-lg)]">{clientProjectsDictionary.safeUi.myProjects}</h1>
          <p className="mt-3 max-w-[42rem] text-body-lg leading-relaxed" style={{ color: "var(--project-hero-muted)" }}>{clientProjectsDictionary.safeUi.pageDescription}</p>
        </div>
        {organizations.length > 0 ? (
          <section className="min-w-0" aria-labelledby="client-project-portfolio-scope">
            <p id="client-project-portfolio-scope" className="text-label lg:text-right" style={{ color: "var(--project-hero-muted)" }}>{clientProjectsDictionary.safeUi.portfolioScope}</p>
            {organizations.length > 1 ? (
              <SelectControl
                aria-label={clientProjectsDictionary.portal.yourOrganizations}
                className="mt-2 h-14 w-full border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-surface-raised)] text-[color:var(--project-hero-foreground)]"
                value={activeOrganizationId}
                onValueChange={onSelectOrganization}
                options={[
                  { value: "all", label: clientProjectsDictionary.portal.allOrganizations },
                  ...organizations.map((organization) => ({ value: organization.id, label: organization.name })),
                ]}
              />
            ) : (
              <div className="mt-2 flex h-14 items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-surface-raised)] px-4">
                <Building2 aria-hidden className="size-4 shrink-0" style={{ color: "var(--accent)" }} />
                <span className="min-w-0 truncate text-title">{scopeLabel}</span>
              </div>
            )}
            <p className="mt-2 text-meta lg:text-right" style={{ color: "var(--project-hero-muted)" }}>
              {clientProjectsDictionary.portal.activeProjectsCount(activeCount)} · {clientProjectsDictionary.safeUi.projectResultCount(totalCount)} {clientProjectsDictionary.safeUi.inPortfolio}
            </p>
          </section>
        ) : null}
      </div>
    </header>
  );
}

export function ClientProjectsListClient({ initialProjects = null }: { initialProjects?: ClientProjectListItem[] | null } = {}) {
  const [group, setGroup] = useState<ClientProjectGroup>("ongoing");
  const [search, setSearch] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("all");

  useEffect(() => {
    setSelectedOrganizationId(readStoredClientOrganizationFilter());
  }, []);

  const selectOrganization = (organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    storeClientOrganizationFilter(organizationId);
  };
  const [projects, setProjects] = useState<ClientProjectListItem[]>(() => initialProjects ?? []);
  const [isLoading, setIsLoading] = useState(!initialProjects);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (reloadKey === 0 && initialProjects) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError(false);
    fetch("/api/account/projects", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as { data?: ClientProjectsResult } | ClientProjectsResult | null;
        if (!response.ok) throw new Error("Unable to load projects");
        const result: ClientProjectsResult | null = payload && "items" in payload
          ? payload
          : payload?.data ?? null;
        if (!result || !Array.isArray(result.items)) throw new Error("Invalid projects response");
        setProjects(result.items);
      })
      .catch((cause) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [initialProjects, reloadKey]);
  const organizations = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const project of projects) {
      for (const organization of project.organizations) byId.set(organization.id, organization);
    }
    return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name, "pt-PT"));
  }, [projects]);
  const activeOrganizationId = organizations.some((organization) => organization.id === selectedOrganizationId)
    ? selectedOrganizationId
    : "all";

  const organizationScopedProjects = useMemo(() => activeOrganizationId === "all"
    ? projects
    : projects.filter((project) => matchesClientProjectOrganization(project, activeOrganizationId)), [activeOrganizationId, projects]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("pt-PT");
    return organizationScopedProjects.filter((project) => {
      const matchesGroup = matchesClientProjectGroup(project, group);
      const matchesSearch = !needle
        || project.name.toLocaleLowerCase("pt-PT").includes(needle)
        || (project.reference ?? "").toLocaleLowerCase("pt-PT").includes(needle)
        || project.organizations.some((organization) => organization.name.toLocaleLowerCase("pt-PT").includes(needle));
      return matchesGroup && matchesSearch;
    });
  }, [group, organizationScopedProjects, search]);

  const groupCounts = useMemo(() => ({
    ongoing: organizationScopedProjects.filter((project) => matchesClientProjectGroup(project, "ongoing")).length,
    completed: organizationScopedProjects.filter((project) => matchesClientProjectGroup(project, "completed")).length,
    all: organizationScopedProjects.length,
  }), [organizationScopedProjects]);

  const portfolioHeader = (
    <ClientProjectsPortfolioHeader
      organizations={organizations}
      activeOrganizationId={activeOrganizationId}
      activeCount={groupCounts.ongoing}
      totalCount={groupCounts.all}
      onSelectOrganization={selectOrganization}
    />
  );

  if (isLoading) return <ClientProjectsListLoading />;
  if (error) return (
    <section className="space-y-6 sm:space-y-8">
      {portfolioHeader}
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-body text-destructive">
        <p>{clientProjectsDictionary.safeUi.projectsLoadError}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setReloadKey((current) => current + 1)}>
          {clientProjectsDictionary.safeUi.retry}
        </Button>
      </div>
    </section>
  );

  if (projects.length === 0) {
    return <section className="space-y-6 sm:space-y-8">{portfolioHeader}<Card variant="light"><EmptyState icon={FolderKanban} title={clientProjectsDictionary.safeUi.emptyProjects} /></Card></section>;
  }

  if (projects.length === 1) {
    return <section className="space-y-6 sm:space-y-8">{portfolioHeader}<ProjectListCard project={projects[0]} emphasis /></section>;
  }

  const showSearch = projects.length >= 6;

  return (
    <section className="space-y-6 sm:space-y-8">
      {portfolioHeader}
      <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border border-border/60 bg-background/70 p-3 shadow-[var(--dashboard-shadow-sm)] sm:p-4" aria-labelledby="client-project-filters-title">
        <div className="flex items-center justify-between gap-4 px-1">
          <h2 id="client-project-filters-title" className="text-label text-foreground">{clientProjectsDictionary.safeUi.filterLabel}</h2>
          <p className="text-meta text-muted-foreground" aria-live="polite">{clientProjectsDictionary.safeUi.projectResultCount(filtered.length)}</p>
        </div>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PillTabs
            ariaLabel={clientProjectsDictionary.safeUi.filterLabel}
            className="max-w-full overflow-x-auto [&>button]:min-h-11 [&>button]:px-3 sm:[&>button]:px-4"
            items={GROUPS.map((item) => ({ value: item.value, label: `${item.label} · ${groupCounts[item.value]}` }))}
            value={group}
            onValueChange={setGroup}
          />
          <div className="min-w-0 sm:w-64">
            {showSearch ? <SearchField value={search} onChange={setSearch} onClear={() => setSearch("")} className="[&>button]:size-11 [&>button]:right-0" inputClassName="h-11 bg-background" placeholder={clientProjectsDictionary.safeUi.searchPlaceholder} /> : null}
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <Card variant="light">
          <EmptyState icon={FolderKanban} title={clientProjectsDictionary.safeUi.emptyFilteredProjects} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((project) => (
            <ProjectListCard
              key={project.id}
              project={project}
              showOrganizations={activeOrganizationId === "all" && organizations.length > 1}
            />
          ))}
        </div>
      )}
      </div>
    </section>
  );
}
