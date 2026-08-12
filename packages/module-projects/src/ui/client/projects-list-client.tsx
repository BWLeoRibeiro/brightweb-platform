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

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("pt-PT");
    return projects.filter((project) => {
      const matchesGroup = matchesClientProjectGroup(project, group);
      const matchesOrganization = activeOrganizationId === "all"
        || project.organizations.some((organization) => organization.id === activeOrganizationId);
      const matchesSearch = !needle
        || project.name.toLocaleLowerCase("pt-PT").includes(needle)
        || (project.reference ?? "").toLocaleLowerCase("pt-PT").includes(needle)
        || project.organizations.some((organization) => organization.name.toLocaleLowerCase("pt-PT").includes(needle));
      return matchesGroup && matchesOrganization && matchesSearch;
    });
  }, [activeOrganizationId, group, projects, search]);

  const groupCounts = useMemo(() => ({
    ongoing: projects.filter((project) => matchesClientProjectGroup(project, "ongoing")).length,
    completed: projects.filter((project) => matchesClientProjectGroup(project, "completed")).length,
    all: projects.length,
  }), [projects]);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label={clientProjectsDictionary.safeUi.filterLabel}>
          {GROUPS.map((item) => (
            <Button key={item.value} type="button" aria-pressed={group === item.value} variant={group === item.value ? "default" : "outline"} size="sm" onClick={() => setGroup(item.value)}>
              {item.label}<span className="ml-1.5 opacity-65">{groupCounts[item.value]}</span>
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {organizations.length > 1 ? (
            <SelectControl
              aria-label={clientProjectsDictionary.portal.yourOrganizations}
              className="sm:w-56"
              value={activeOrganizationId}
              onValueChange={selectOrganization}
              options={[
                { value: "all", label: clientProjectsDictionary.portal.allOrganizations },
                ...organizations.map((organization) => ({ value: organization.id, label: organization.name })),
              ]}
            />
          ) : null}
          {showSearch ? <SearchField size="sm" value={search} onChange={setSearch} onClear={() => setSearch("")} placeholder={clientProjectsDictionary.safeUi.searchPlaceholder} /> : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card variant="light">
          <EmptyState icon={FolderKanban} title={clientProjectsDictionary.safeUi.emptyFilteredProjects} />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((project) => <ProjectListCard key={project.id} project={project} />)}
        </div>
      )}
    </div>
  );
}
