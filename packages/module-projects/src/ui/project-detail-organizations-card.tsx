"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Crown, Loader2, Pencil, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Checkbox, SearchField, Sheet, SheetContent, SheetFooter, Skeleton } from "@brightweblabs/ui";
import { useProjectsUiClient } from "./context";
import { sheetBodyClassName, sheetFooterClassName, sheetShellClassName } from "./constants";
import { AppSheetHeader } from "./shared/app-sheet";
import { useProjectDetailData } from "./project-detail-data-provider";
import { ProjectSurfaceCard, ProjectSurfaceSectionHeader } from "./shared/project-surface-card";
import { projectAccessDictionary } from "./project-access-dictionary";

type OrganizationOption = { id: string; name: string };

export function ProjectDetailOrganizationsCard({ canManage = false }: { canManage?: boolean }) {
  const client = useProjectsUiClient();
  const router = useRouter();
  const { project } = useProjectDetailData();
  const organizations = useMemo(() => project.participatingOrganizations?.length
    ? project.participatingOrganizations
    : [{ id: project.organizationId, name: project.organizationName, isPrimary: true }], [project.organizationId, project.organizationName, project.participatingOrganizations]);
  const primaryOrganizationId = organizations.find((organization) => organization.isPrimary)?.id ?? project.organizationId;
  const currentIds = useMemo(() => organizations.map((organization) => organization.id).toSorted(), [organizations]);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OrganizationOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(currentIds);
  const [search, setSearch] = useState("");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setSelectedIds(currentIds), [currentIds]);

  const loadOptions = useCallback(async (signal?: AbortSignal) => {
    setLoadState("loading");
    try {
      const loaded = await client.listOrganizations({ signal });
      if (signal?.aborted) return;
      const known = new Map(loaded.map((organization) => [organization.id, organization]));
      for (const organization of organizations) known.set(organization.id, organization);
      setOptions([...known.values()].toSorted((a, b) => a.name.localeCompare(b.name, "pt-PT")));
      setLoadState("ready");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setLoadState("error");
    }
  }, [client, organizations]);

  useEffect(() => {
    if (!open || loadState !== "idle") return;
    const controller = new AbortController();
    void loadOptions(controller.signal);
    return () => controller.abort();
  }, [loadOptions, loadState, open]);

  const dirty = currentIds.join(",") !== [...selectedIds].toSorted().join(",");
  const removedCount = currentIds.filter((id) => !selectedIds.includes(id)).length;
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-PT");
  const filteredOptions = options.filter((organization) => (
    !normalizedSearch || organization.name.toLocaleLowerCase("pt-PT").includes(normalizedSearch)
  ));

  const requestClose = () => {
    if (isSaving) return;
    if (dirty && !window.confirm(projectAccessDictionary.organizationEditor.unsavedConfirm)) return;
    setOpen(false);
    setSearch("");
  };

  const save = async () => {
    if (!dirty || isSaving || !selectedIds.includes(primaryOrganizationId)) return;
    if (removedCount > 0 && !window.confirm(projectAccessDictionary.organizationEditor.revokeConfirm)) return;
    setIsSaving(true);
    try {
      const response = await client.requestRaw(`/api/projects/${project.id}/organizations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationIds: selectedIds }),
      });
      const payload = await response.json().catch(() => null) as { error?: string | { message?: string } } | null;
      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
        throw new Error(message || projectAccessDictionary.organizationEditor.saveError);
      }
      toast.success(projectAccessDictionary.organizationEditor.updated);
      setOpen(false);
      setSearch("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : projectAccessDictionary.organizationEditor.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ProjectSurfaceCard className="h-full">
        <div className="p-4">
          <ProjectSurfaceSectionHeader
            icon={Building2}
            title={projectAccessDictionary.detail.organizations}
            subtitle={projectAccessDictionary.detail.organizationCount(organizations.length)}
            rightSlot={canManage ? <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedIds(currentIds); setLoadState("idle"); setOpen(true); }}><Pencil className="mr-1.5 size-3.5" />{projectAccessDictionary.organizationEditor.edit}</Button> : null}
          />
          <ul className="mt-4 overflow-hidden rounded-xl border border-[color:var(--border)]">
            {organizations.map((organization) => (
              <li key={organization.id} className="flex min-h-12 items-center gap-3 border-t border-[color:var(--border)] px-3 py-2 first:border-t-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--muted)] text-muted-foreground"><Building2 className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">{organization.name}</span>
                {organization.isPrimary ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--border)] px-2 py-0.5 text-micro font-semibold text-muted-foreground"><Crown className="size-3" aria-hidden="true" />{projectAccessDictionary.detail.primary}</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-micro leading-relaxed text-muted-foreground">{projectAccessDictionary.detail.organizationAccessHint}</p>
        </div>
      </ProjectSurfaceCard>

      <Sheet open={open} onOpenChange={(next) => next ? setOpen(true) : requestClose()}>
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader icon={Building2} editing eyebrow={projectAccessDictionary.organizationEditor.eyebrow} title={<>{projectAccessDictionary.organizationEditor.title}</>} description={<>{projectAccessDictionary.organizationEditor.description}</>} />
          <div className={`${sheetBodyClassName} space-y-3`}>
            {loadState === "loading" ? <div className="space-y-2">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-12 w-full" rounded="12px" />)}</div> : null}
            {loadState === "error" ? <div className="rounded-xl border border-dashed border-[color:var(--border)] px-4 py-6 text-center"><p className="text-body font-semibold">{projectAccessDictionary.organizationEditor.loadError}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void loadOptions()}><RotateCcw className="mr-1.5 size-3.5" />{projectAccessDictionary.organizationEditor.retry}</Button></div> : null}
            {loadState === "ready" ? <>
              <SearchField size="sm" value={search} onChange={setSearch} onClear={() => setSearch("")} placeholder={projectAccessDictionary.organizationEditor.search} />
              <div className="space-y-2">
                {filteredOptions.map((organization) => {
                  const selected = selectedIds.includes(organization.id);
                  const primary = organization.id === primaryOrganizationId;
                  return <label key={organization.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--border)] px-3 py-2.5">
                    <Checkbox checked={selected} disabled={primary || isSaving} onChange={() => setSelectedIds((current) => selected ? current.filter((id) => id !== organization.id) : [...current, organization.id])} />
                    <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-body font-semibold">{organization.name}</span>
                    {primary ? <span className="text-micro font-semibold text-muted-foreground">{projectAccessDictionary.organizationEditor.primary}</span> : null}
                  </label>;
                })}
                {filteredOptions.length === 0 ? <p className="py-6 text-center text-meta text-muted-foreground">{projectAccessDictionary.organizationEditor.emptySearch}</p> : null}
              </div>
            </> : null}
          </div>
          <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
            <Button type="button" className="flex-1" disabled={!dirty || loadState !== "ready" || isSaving} onClick={save}>{isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}{isSaving ? projectAccessDictionary.organizationEditor.saving : projectAccessDictionary.organizationEditor.save}</Button>
            <Button type="button" variant="outline" className="flex-1" disabled={isSaving} onClick={requestClose}>{projectAccessDictionary.organizationEditor.cancel}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
