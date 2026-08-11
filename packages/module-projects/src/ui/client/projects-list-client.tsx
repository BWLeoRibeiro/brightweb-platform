"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderKanban } from "lucide-react";
import { Button, SearchField } from "@brightweblabs/ui";
import type { ClientProjectListItem, ClientProjectsResult } from "../../client-contracts";
import { ProjectListCard } from "./project-list-card";
import { ClientProjectsListLoading } from "./projects-loading";
import { clientProjectsDictionary } from "./dictionary";

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
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("pt-PT");
    return projects.filter((project) => {
      const matchesGroup = matchesClientProjectGroup(project, group);
      const matchesSearch = !needle
        || project.name.toLocaleLowerCase("pt-PT").includes(needle)
        || (project.reference ?? "").toLocaleLowerCase("pt-PT").includes(needle)
        || project.organizations.some((organization) => organization.name.toLocaleLowerCase("pt-PT").includes(needle));
      return matchesGroup && matchesSearch;
    });
  }, [group, projects, search]);

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
      <div className="rounded-2xl border border-border/60 bg-background/60 px-5 py-14 text-center">
        <FolderKanban className="mx-auto mb-3 size-10 text-muted-foreground/30" />
        <p className="text-body text-muted-foreground">{clientProjectsDictionary.safeUi.emptyProjects}</p>
      </div>
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
        {showSearch ? <SearchField size="sm" value={search} onChange={setSearch} onClear={() => setSearch("")} placeholder={clientProjectsDictionary.safeUi.searchPlaceholder} /> : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-10 text-center">
          <FolderKanban className="mx-auto mb-3 size-10 text-muted-foreground/30" />
          <p className="text-body text-muted-foreground">
            {clientProjectsDictionary.safeUi.emptyFilteredProjects}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((project) => <ProjectListCard key={project.id} project={project} />)}
        </div>
      )}
    </div>
  );
}
