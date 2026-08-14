"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderKanban } from "lucide-react";
import { PillTabs } from "@brightweblabs/app-shell";
import { Button, Card, CoverHeader, EmptyState, SearchField } from "@brightweblabs/ui";
import type { ClientProjectListItem, ClientProjectsResult } from "../../client-contracts";
import { OrganizationFilterMenu } from "./organization-filter-menu";
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
  return (
    <CoverHeader>
      <div className={`grid gap-7 ${organizations.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end" : ""}`}>
        <div className="max-w-[48rem]">
          <span className="-mt-8 flex size-16 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground shadow-[var(--cover-header-avatar-shadow)]">
            <FolderKanban aria-hidden className="size-6" />
          </span>
          <p className="mt-4 inline-flex items-center gap-2 text-label font-semibold text-muted-foreground">
            {clientProjectsDictionary.safeUi.portfolioEyebrow}
          </p>
          <h1 className="font-display mt-1 text-[length:var(--text-ui-dashboard-title)] font-black leading-[var(--type-leading-110)] tracking-[var(--type-tracking-n025)] sm:text-[length:var(--text-ui-dashboard-title-lg)]">{clientProjectsDictionary.safeUi.myProjects}</h1>
          <p className="mt-3 max-w-[42rem] text-body-lg leading-relaxed text-muted-foreground">{clientProjectsDictionary.safeUi.pageDescription}</p>
        </div>
        {organizations.length > 0 ? (
          <OrganizationFilterMenu
            organizations={organizations}
            selectedOrganizationId={activeOrganizationId}
            onSelect={onSelectOrganization}
            description={`${clientProjectsDictionary.portal.activeProjectsCount(activeCount)} · ${clientProjectsDictionary.safeUi.projectResultCount(totalCount)} ${clientProjectsDictionary.safeUi.inPortfolio}`}
            surface="light"
          />
        ) : null}
      </div>
    </CoverHeader>
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
          <div className="portal-scroll -m-1 max-w-full overflow-x-auto p-1">
            <PillTabs
              ariaLabel={clientProjectsDictionary.safeUi.filterLabel}
              items={GROUPS.map((item) => ({ value: item.value, label: `${item.label} · ${groupCounts[item.value]}` }))}
              value={group}
              onValueChange={setGroup}
            />
          </div>
          {showSearch ? (
            <div className="min-w-0 sm:w-64">
              <SearchField value={search} onChange={setSearch} onClear={() => setSearch("")} className="[&>button]:size-11 [&>button]:right-0" inputClassName="h-11 bg-background" placeholder={clientProjectsDictionary.safeUi.searchPlaceholder} />
            </div>
          ) : null}
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
