"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderKanban } from "lucide-react";
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

  if (isLoading) return <ClientProjectsListLoading />;
  if (error) return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-body text-destructive">
      <p>{clientProjectsDictionary.safeUi.projectsLoadError}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setReloadKey((current) => current + 1)}>
        {clientProjectsDictionary.safeUi.retry}
      </Button>
    </div>
  );

  if (projects.length === 0) {
    return (
      <Card variant="light">
        <EmptyState icon={FolderKanban} title={clientProjectsDictionary.safeUi.emptyProjects} />
      </Card>
    );
  }

  if (projects.length === 1) {
    return <ProjectListCard project={projects[0]} emphasis />;
  }

  const showSearch = projects.length >= 6;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border border-border/60 bg-background/70 p-3 shadow-[var(--dashboard-shadow-sm)] sm:p-4" aria-labelledby="client-project-filters-title">
        <div className="flex items-center justify-between gap-4 px-1">
          <h2 id="client-project-filters-title" className="text-label text-foreground">{clientProjectsDictionary.safeUi.filterLabel}</h2>
          <p className="text-meta text-muted-foreground" aria-live="polite">{clientProjectsDictionary.safeUi.projectResultCount(filtered.length)}</p>
        </div>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-control)] bg-muted/65 p-1" role="group" aria-label={clientProjectsDictionary.safeUi.filterLabel}>
            {GROUPS.map((item) => {
              const selected = group === item.value;
              return (
                <Button
                  key={item.value}
                  type="button"
                  aria-pressed={selected}
                  variant="ghost"
                  className={`min-h-11 px-3 ${selected ? "bg-background text-foreground shadow-[var(--dashboard-shadow-sm)] hover:bg-background" : "text-muted-foreground"}`}
                  onClick={() => setGroup(item.value)}
                >
                  {item.label}
                  <span className={`ml-1 min-w-5 rounded-full px-1.5 py-0.5 text-micro ${selected ? "bg-primary/10 text-primary" : "bg-background/65 text-muted-foreground"}`}>{groupCounts[item.value]}</span>
                </Button>
              );
            })}
          </div>
          <div className={`grid min-w-0 gap-3 lg:w-[31rem] ${organizations.length > 1 && showSearch ? "sm:grid-cols-2" : ""}`}>
            {organizations.length > 1 ? (
              <SelectControl
                aria-label={clientProjectsDictionary.portal.yourOrganizations}
                className="h-11 w-full bg-background"
                value={activeOrganizationId}
                onValueChange={selectOrganization}
                options={[
                  { value: "all", label: clientProjectsDictionary.portal.allOrganizations },
                  ...organizations.map((organization) => ({ value: organization.id, label: organization.name })),
                ]}
              />
            ) : null}
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
  );
}
