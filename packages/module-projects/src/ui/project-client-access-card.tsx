"use client";

import { useMemo, useState } from "react";
import { Building2, Eye, EyeOff, Loader2, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, FieldContent, FieldLabel, Sheet, SheetContent, SheetFooter, Skeleton, StyledSelect } from "@brightweblabs/ui";
import { sheetBodyClassName, sheetFooterClassName, sheetShellClassName } from "./constants";
import { AppSheetHeader, SheetSection } from "./shared/app-sheet";
import { ProjectSurfaceCard, ProjectSurfaceSectionHeader } from "./shared/project-surface-card";
import {
  CLIENT_ACCESS_MODE_COPY,
  getClientAccessDraftError,
  ProjectClientAccessEditor,
  type ClientAccessDraft,
} from "./project-client-access-editor";
import { useProjectClientAccess } from "./use-project-client-access";
import { sheetAccentTextareaClassName, sheetEditControlClassName, sheetFieldLabelClassName } from "./shared/sheet-section";
import { cn } from "./utils";
import type { ProjectClientAccessMode } from "../contracts";
import { projectAccessDictionary } from "./project-access-dictionary";

export type ProjectClientAccessReadSummary = {
  mode: ProjectClientAccessMode;
  organizationNames: string[];
  organizationCount: number;
  selectedClientCount: number;
  contentReadiness: {
    hasSummary: boolean;
    hasScope: boolean;
    hasContact: boolean;
    clientVisibleMilestoneCount: number;
    sharedDocumentCount: number;
  };
};

function accessSummary(data: ClientAccessDraft): string {
  if (data.mode === "hidden") return projectAccessDictionary.card.hiddenSummary;
  const selectedOrganizations = data.organizations.filter((organization) => organization.selected);
  if (data.mode === "all_org_clients") {
    return projectAccessDictionary.card.allOrganizations(selectedOrganizations.length);
  }
  const selectedClients = new Set(selectedOrganizations.flatMap((organization) => organization.selectedProfileIds)).size;
  return projectAccessDictionary.card.selectedClients(selectedClients);
}

function isAudienceNarrower(before: ClientAccessDraft, after: ClientAccessDraft): boolean {
  if (before.mode === "hidden") return false;
  if (after.mode === "hidden") return true;
  const beforeOrganizations = new Set(before.organizations.filter((organization) => organization.selected).map((organization) => organization.organizationId));
  const afterOrganizations = new Set(after.organizations.filter((organization) => organization.selected).map((organization) => organization.organizationId));
  if ([...beforeOrganizations].some((organizationId) => !afterOrganizations.has(organizationId))) return true;
  if (before.mode === "all_org_clients" && after.mode === "selected_clients") return true;
  if (before.mode !== "selected_clients" || after.mode !== "selected_clients") return false;
  const beforeProfiles = new Set(before.organizations.flatMap((organization) => organization.selectedProfileIds));
  const afterProfiles = new Set(after.organizations.flatMap((organization) => organization.selectedProfileIds));
  return [...beforeProfiles].some((profileId) => !afterProfiles.has(profileId));
}

export function ProjectClientAccessCard({
  projectId,
  canManage,
  summary,
  internalContactOptions = [],
  clientPreviewHref,
}: {
  projectId: string;
  canManage: boolean;
  summary?: ProjectClientAccessReadSummary | null;
  internalContactOptions?: Array<{ profileId: string; label: string; email: string | null }>;
  clientPreviewHref?: string;
}) {
  const resource = useProjectClientAccess(projectId, canManage);
  const fieldIdPrefix = `project-${projectId}-client-access`;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ClientAccessDraft | null>(null);

  const dirty = useMemo(() => Boolean(
    draft && resource.data && JSON.stringify(draft) !== JSON.stringify(resource.data),
  ), [draft, resource.data]);
  const validationError = draft ? getClientAccessDraftError(draft) : null;
  const selectedOrganizations = resource.data?.organizations.filter((organization) => organization.selected) ?? [];
  const displayMode = resource.data?.mode ?? summary?.mode;
  const displaySummary = resource.data
    ? accessSummary(resource.data)
    : summary
      ? summary.mode === "hidden"
        ? projectAccessDictionary.card.hiddenSummary
        : summary.mode === "all_org_clients"
          ? projectAccessDictionary.card.allOrganizations(summary.organizationCount)
          : projectAccessDictionary.card.selectedClients(summary.selectedClientCount)
      : projectAccessDictionary.card.notConfigured;
  const responsibleContactOptions = useMemo(
    () => [...internalContactOptions].sort((a, b) => a.label.localeCompare(b.label, "pt-PT")),
    [internalContactOptions],
  );

  const openEditor = () => {
    if (!resource.data) return;
    setDraft(structuredClone(resource.data));
    setOpen(true);
  };

  const requestClose = () => {
    if (resource.isSaving) return;
    if (dirty && !window.confirm(projectAccessDictionary.card.unsavedConfirm)) return;
    setOpen(false);
  };

  const save = async () => {
    if (!draft || validationError) return;
    if (resource.data && isAudienceNarrower(resource.data, draft)) {
      const confirmed = window.confirm(projectAccessDictionary.card.revokeConfirm);
      if (!confirmed) return;
    }
    try {
      await resource.save(draft);
      setOpen(false);
      toast.success(projectAccessDictionary.card.updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : projectAccessDictionary.resource.saveError);
    }
  };

  const Icon = displayMode === "hidden" ? EyeOff : Eye;

  return (
    <>
      <ProjectSurfaceCard className="h-full">
        <div className="p-4">
          <ProjectSurfaceSectionHeader
            icon={Icon}
            title={projectAccessDictionary.card.title}
            subtitle={canManage && resource.isLoading
              ? projectAccessDictionary.card.loading
              : canManage && resource.loadError
                ? projectAccessDictionary.card.verifyError
                : displaySummary}
            rightSlot={canManage ? (
              <Button type="button" variant="outline" size="sm" disabled={!resource.data || resource.isLoading} onClick={openEditor}>
                {projectAccessDictionary.card.manage}
              </Button>
            ) : null}
          />

          {canManage && resource.isLoading ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-7 w-44" rounded="999px" />
              <Skeleton className="h-4 w-64 max-w-full" rounded="999px" />
            </div>
          ) : canManage && resource.loadError ? (
            <div className="mt-4 rounded-xl border border-dashed border-[color:var(--border)] px-3.5 py-3">
              <p className="text-meta text-muted-foreground">{resource.loadError}</p>
              <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={resource.reload}>
                <RotateCcw className="mr-1.5 size-3.5" />
                {projectAccessDictionary.card.retry}
              </Button>
            </div>
          ) : displayMode ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/25 px-3 py-2.5">
                <span className={`size-2 rounded-full ${displayMode === "hidden" ? "bg-muted-foreground/45" : "bg-emerald-500"}`} aria-hidden="true" />
                <p className="min-w-0 flex-1 text-meta font-semibold text-foreground">{CLIENT_ACCESS_MODE_COPY[displayMode].title}</p>
                {clientPreviewHref && displayMode !== "hidden" ? (
                  <a href={clientPreviewHref} className="text-meta font-semibold text-[color:var(--primary)] hover:underline">{projectAccessDictionary.card.preview}</a>
                ) : null}
              </div>
              {(selectedOrganizations.length > 0 || (summary?.organizationNames.length ?? 0) > 0) ? (
                <div className="flex flex-wrap gap-1.5">
                  {(selectedOrganizations.length > 0
                    ? selectedOrganizations.map((organization) => ({ key: organization.organizationId, name: organization.organizationName }))
                    : (summary?.organizationNames ?? []).map((name) => ({ key: name, name }))).map((organization) => (
                    <span key={organization.key} className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-2.5 py-1 text-meta text-muted-foreground">
                      <Building2 className="size-3" aria-hidden="true" />
                      {organization.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-meta leading-relaxed text-muted-foreground">{projectAccessDictionary.card.remainsPrivate}</p>
              )}
              {!canManage ? (
                <p className="text-micro text-muted-foreground">{projectAccessDictionary.card.managersOnly}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </ProjectSurfaceCard>

      <Sheet open={open} onOpenChange={(next) => next ? openEditor() : requestClose()}>
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader
            icon={ShieldCheck}
            editing
            eyebrow={projectAccessDictionary.card.eyebrow}
            title={<>{projectAccessDictionary.card.title}</>}
            description={<>{projectAccessDictionary.card.description}</>}
          />
          <div className={`${sheetBodyClassName} space-y-4`}>
            <SheetSection title={projectAccessDictionary.card.audienceSection} editing bodyClassName="px-4 py-3">
              {draft ? <ProjectClientAccessEditor value={draft} onChange={setDraft} disabled={resource.isSaving} /> : null}
            </SheetSection>
            {draft ? (
              <SheetSection title={projectAccessDictionary.card.clientInformation} editing>
                <div className="border-b border-[color:var(--border)] px-4 py-3">
                  <p className="text-meta leading-relaxed text-muted-foreground">{projectAccessDictionary.card.clientInformationDescription}</p>
                </div>
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel htmlFor={`${fieldIdPrefix}-summary`} className={sheetFieldLabelClassName}>{projectAccessDictionary.card.clientSummary}</FieldLabel>
                  <FieldContent><textarea id={`${fieldIdPrefix}-summary`} rows={3} value={draft.clientSummary ?? ""} disabled={resource.isSaving} onChange={(event) => setDraft({ ...draft, clientSummary: event.target.value })} className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)} /></FieldContent>
                </Field>
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel htmlFor={`${fieldIdPrefix}-scope`} className={sheetFieldLabelClassName}>{projectAccessDictionary.card.clientScope}</FieldLabel>
                  <FieldContent><textarea id={`${fieldIdPrefix}-scope`} rows={3} value={draft.clientScope ?? ""} disabled={resource.isSaving} onChange={(event) => setDraft({ ...draft, clientScope: event.target.value })} className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)} /></FieldContent>
                </Field>
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel htmlFor={`${fieldIdPrefix}-contact`} className={sheetFieldLabelClassName}>{projectAccessDictionary.card.responsibleContact}</FieldLabel>
                  <FieldContent>
                    <StyledSelect id={`${fieldIdPrefix}-contact`} value={draft.clientContactProfileId ?? ""} disabled={resource.isSaving} onChange={(event) => setDraft({ ...draft, clientContactProfileId: event.target.value || null })} className={cn(sheetEditControlClassName, "mt-1.5 block w-full")}>
                      <option value="">{projectAccessDictionary.card.noContact}</option>
                      {responsibleContactOptions.map((contact) => <option key={contact.profileId} value={contact.profileId}>{contact.label}{contact.email ? ` · ${contact.email}` : ""}</option>)}
                    </StyledSelect>
                    <p className="mt-1 text-micro text-muted-foreground">{projectAccessDictionary.card.responsibleContactHint}</p>
                  </FieldContent>
                </Field>
              </SheetSection>
            ) : null}
          </div>
          <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
            <Button type="button" className="flex-1" disabled={!dirty || Boolean(validationError) || resource.isSaving} onClick={save}>
              {resource.isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              {resource.isSaving ? projectAccessDictionary.card.saving : projectAccessDictionary.card.save}
            </Button>
            <Button type="button" variant="outline" className="flex-1" disabled={resource.isSaving} onClick={requestClose}>{projectAccessDictionary.card.cancel}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
