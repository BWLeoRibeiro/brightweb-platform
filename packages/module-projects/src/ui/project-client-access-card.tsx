"use client";

import { useMemo, useRef, useState } from "react";
import { Building2, EyeOff, Loader2, Pencil, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Sheet,
  SheetContent,
  SheetFooter,
  Skeleton,
  StatusPill,
  TooltipProvider,
} from "@brightweblabs/ui";
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
import { cn } from "./utils";
import type { ProjectClientAccessMode } from "../contracts";
import { projectAccessDictionary } from "./project-access-dictionary";
import { SectionIconButton } from "./shared/section-icon-button";
import { SectionEmptyState } from "./shared/section-feedback";
import { compactCollectionRevealClassName } from "./shared/compact-collection";

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
  organizationName,
  clientPreviewHref,
}: {
  projectId: string;
  canManage: boolean;
  summary?: ProjectClientAccessReadSummary | null;
  organizationName?: string | null;
  clientPreviewHref?: string;
}) {
  const resource = useProjectClientAccess(projectId, canManage);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ClientAccessDraft | null>(null);
  const [confirmIntent, setConfirmIntent] = useState<"discard" | "revoke" | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const dirty = useMemo(() => Boolean(
    draft && resource.data && JSON.stringify(draft) !== JSON.stringify(resource.data),
  ), [draft, resource.data]);
  const validationError = draft ? getClientAccessDraftError(draft) : null;
  const selectedOrganizations = resource.data?.organizations.filter((organization) => organization.selected) ?? [];
  const displayMode = resource.data?.mode ?? summary?.mode;
  const displayedOrganizations = selectedOrganizations.length > 0
    ? selectedOrganizations.map((organization) => ({
      key: organization.organizationId,
      name: organization.organizationName,
      selectedClientCount: organization.selectedProfileIds.length,
    }))
    : (organizationName ? [organizationName] : (summary?.organizationNames ?? []).slice(0, 1)).map((name, index, organizations) => ({
      key: name,
      name,
      selectedClientCount: summary?.mode === "selected_clients" && organizations.length === 1
        ? summary.selectedClientCount
        : null,
    }));
  const openEditor = () => {
    if (!resource.data) return;
    setDraft(structuredClone(resource.data));
    setConfirmIntent(null);
    setOpen(true);
  };

  const requestClose = () => {
    if (resource.isSaving) return;
    if (dirty) {
      setConfirmIntent("discard");
      return;
    }
    setOpen(false);
  };

  const persistDraft = async () => {
    if (!draft || validationError) return;
    try {
      await resource.save(draft);
      setOpen(false);
      toast.success(projectAccessDictionary.card.updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : projectAccessDictionary.resource.saveError);
    }
  };

  const requestSave = () => {
    if (!draft || validationError) return;
    if (resource.data && isAudienceNarrower(resource.data, draft)) {
      setConfirmIntent("revoke");
      return;
    }
    void persistDraft();
  };

  const isShared = Boolean(displayMode && displayMode !== "hidden");

  return (
    <>
      <ProjectSurfaceCard className="self-start">
        <ProjectSurfaceSectionHeader
          icon={ShieldCheck}
          title={projectAccessDictionary.card.title}
          subtitle={canManage && resource.isLoading
            ? projectAccessDictionary.card.loading
            : canManage && resource.loadError
              ? projectAccessDictionary.card.verifyError
              : projectAccessDictionary.card.areaSubtitle}
          rightSlot={canManage ? (
            <TooltipProvider>
              <SectionIconButton
                icon={Pencil}
                label={projectAccessDictionary.card.manage}
                disabled={!resource.data || resource.isLoading}
                onClick={openEditor}
              />
            </TooltipProvider>
          ) : null}
        />

        {canManage && resource.isLoading ? (
          <div className="mt-4 space-y-2 rounded-[var(--radius-card)] border border-[color:var(--border)] px-3.5 py-3.5">
            <Skeleton className="h-5 w-20" rounded="999px" />
            <Skeleton className="h-5 w-52 max-w-full" rounded="8px" />
            <Skeleton className="h-4 w-72 max-w-full" rounded="8px" />
          </div>
        ) : canManage && resource.loadError ? (
          <div className="mt-4 rounded-xl border border-dashed border-[color:var(--border)] px-3.5 py-3">
            <p className="text-meta text-muted-foreground">{resource.loadError}</p>
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={resource.reload}>
              <RotateCcw className="mr-1.5 size-3.5" />
              {projectAccessDictionary.card.retry}
            </Button>
          </div>
        ) : displayMode === "hidden" ? (
          <div className="mt-4">
            <SectionEmptyState
              icon={EyeOff}
              message={projectAccessDictionary.card.hiddenSummary}
              hint={projectAccessDictionary.card.remainsPrivate}
            />
            {!canManage ? <p className="mt-2 text-micro text-muted-foreground">{projectAccessDictionary.card.managersOnly}</p> : null}
          </div>
        ) : isShared && displayedOrganizations.length > 0 ? (
          <div className="mt-4">
            <ul className={`${compactCollectionRevealClassName} overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border)]`}>
              {displayedOrganizations.map((organization) => (
                <li key={organization.key} className="flex min-h-[3.25rem] items-center gap-3 border-t border-[color:var(--border)] px-3 py-2 first:border-t-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--project-ui-color-74)] text-[color:var(--role-client-strong)]">
                    <Building2 className="size-4" aria-hidden="true" />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">{organization.name}</p>
                  <StatusPill token="--role-client">
                    {displayMode === "all_org_clients"
                      ? CLIENT_ACCESS_MODE_COPY.all_org_clients.title
                      : organization.selectedClientCount === null
                        ? CLIENT_ACCESS_MODE_COPY.selected_clients.title
                        : projectAccessDictionary.card.selectedClients(organization.selectedClientCount)}
                  </StatusPill>
                </li>
              ))}
            </ul>
            {clientPreviewHref ? <a href={clientPreviewHref} className="mt-2 inline-flex text-meta font-semibold text-[color:var(--primary)] hover:underline">{projectAccessDictionary.card.preview}</a> : null}
            {!canManage ? <p className="mt-2 text-micro text-muted-foreground">{projectAccessDictionary.card.managersOnly}</p> : null}
          </div>
        ) : displayMode ? (
          <div className="mt-4"><SectionEmptyState message={projectAccessDictionary.card.noAudience} hint={projectAccessDictionary.card.noAudienceHint} icon={Building2} /></div>
        ) : null}
      </ProjectSurfaceCard>

      <Sheet open={open} onOpenChange={(next) => next ? openEditor() : requestClose()}>
        <SheetContent
          ref={sheetRef}
          tabIndex={-1}
          className={cn(sheetShellClassName, "focus:outline-none")}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            sheetRef.current?.focus({ preventScroll: true });
          }}
        >
          <AppSheetHeader
            icon={ShieldCheck}
            editing
            eyebrow={projectAccessDictionary.card.eyebrow}
            title={<>{projectAccessDictionary.card.title}</>}
            description={<>{projectAccessDictionary.card.description}</>}
          />
          <div className={`${sheetBodyClassName} space-y-4`}>
            <SheetSection title={projectAccessDictionary.card.audienceSection} editing bodyClassName="px-4 py-3">
              {draft ? (
                <ProjectClientAccessEditor
                  value={draft}
                  onChange={setDraft}
                  disabled={resource.isSaving}
                  showIntroduction={false}
                  showAudienceQuestion={false}
                  compactModes
                />
              ) : null}
            </SheetSection>
          </div>
          <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
            <Button type="button" className="flex-1" disabled={!dirty || Boolean(validationError) || resource.isSaving} onClick={requestSave}>
              {resource.isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              {resource.isSaving ? projectAccessDictionary.card.saving : projectAccessDictionary.card.save}
            </Button>
            <Button type="button" variant="outline" className="flex-1" disabled={resource.isSaving} onClick={requestClose}>{projectAccessDictionary.card.cancel}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={confirmIntent !== null}
        onOpenChange={(next) => {
          if (!next && !resource.isSaving) setConfirmIntent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmIntent === "revoke"
                ? projectAccessDictionary.card.revokeTitle
                : projectAccessDictionary.card.discardTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmIntent === "revoke"
                ? projectAccessDictionary.card.revokeDescription
                : projectAccessDictionary.card.discardDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {confirmIntent === "revoke"
                ? projectAccessDictionary.card.keepAccess
                : projectAccessDictionary.card.keepEditing}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const intent = confirmIntent;
                setConfirmIntent(null);
                if (intent === "revoke") {
                  void persistDraft();
                  return;
                }
                setOpen(false);
              }}
            >
              {confirmIntent === "revoke"
                ? projectAccessDictionary.card.confirmRevoke
                : projectAccessDictionary.card.discardChanges}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
