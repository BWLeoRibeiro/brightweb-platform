"use client";

import { useProjectsUiClient, useProjectsUiDictionary } from "./context";
import { defaultProjectsUiDictionary } from "./dictionary";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ExternalLink, FileText, FolderOpen, Globe, Link2, PencilLine, Save, Table2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useProjectDetailActions, useProjectDetailLinks } from "./project-detail-data-provider";
import { PROJECTS_EVENTS, dispatchProjectsEvent } from "./events";
import { isValidProjectLinkUrl, normalizeProjectLinkUrl } from "./project-link-url-utils";
import {
  sheetBodyClassName,
  sheetFooterClassName,
  sheetShellClassName,
} from "./constants";
import { AppSheetHeader, SheetSection } from "./shared/app-sheet";
import {
  sheetEditControlClassName,
  sheetFieldLabelClassName,
  sheetViewControlClassName,
} from "./shared/sheet-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@brightweblabs/ui";
import { Button } from "@brightweblabs/ui";
import { Input } from "@brightweblabs/ui";
import { ProjectSurfaceCard, ProjectSurfaceSectionHeader } from "./shared/project-surface-card";
import { SectionAddButton } from "./shared/section-icon-button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
} from "@brightweblabs/ui";
import { ProjectPill } from "./shared/project-pill";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@brightweblabs/ui";
import type { ProjectLink } from "../types";
import { cn } from "./utils";

type SheetMode = "view" | "edit";

type ProjectLinksCardProps = {
  projectId: string;
  canCreateItems: boolean;
  canManageItems: boolean;
};

type LinkFormState = {
  label: string;
  url: string;
  kind: string;
  visibility: string;
};

const LINK_KIND_CONFIG = {
  doc: {
    label: defaultProjectsUiDictionary.links.kinds.doc,
    icon: FileText,
    iconBgClass: "bg-[color:var(--project-ui-color-11)]",
    iconClass: "text-[color:var(--project-ui-color-12)]",
  },
  sheet: {
    label: defaultProjectsUiDictionary.links.kinds.sheet,
    icon: Table2,
    iconBgClass: "bg-[color:var(--project-ui-color-13)]",
    iconClass: "text-[color:var(--project-state-active-strong)]",
  },
  drive: {
    label: defaultProjectsUiDictionary.links.kinds.drive,
    icon: FolderOpen,
    iconBgClass: "bg-[color:var(--project-ui-color-14)]",
    iconClass: "text-[color:var(--project-risk-at-risk-strong)]",
  },
  other: {
    label: defaultProjectsUiDictionary.links.kinds.other,
    icon: Globe,
    iconBgClass: "bg-[color:var(--project-ui-color-15)]",
    iconClass: "text-[color:var(--muted-foreground)]",
  },
} as const;

function getLinkKindConfig(kind: string) {
  return LINK_KIND_CONFIG[kind as keyof typeof LINK_KIND_CONFIG] ?? LINK_KIND_CONFIG.other;
}

function safeGetHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeLinkForm(form: LinkFormState) {
  return {
    label: form.label.trim(),
    url: form.url.trim(),
    kind: form.kind,
    visibility: form.visibility,
  };
}

function LinksEmptyState() {
  const dictionary = useProjectsUiDictionary();
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl border border-black/10 bg-foreground/5">
        <Link2 className="size-5 text-foreground/30" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground/60">{dictionary.links.noLinks}</p>
        <p className="mt-1 text-xs text-foreground/40">{dictionary.links.noLinksHint}</p>
      </div>
    </div>
  );
}

function LinkVisibilityPill({ visibility }: { visibility: string }) {
  const dictionary = useProjectsUiDictionary();
  const isStaff = visibility === "staff";

  return (
    <ProjectPill
      size="small"
      className={
        isStaff
          ? "border-border-hairline-soft bg-[color:var(--project-ui-color-16)] text-[color:var(--muted-foreground)]"
          : "border-[color:var(--project-ui-color-17)] bg-[color:var(--project-ui-color-18)] text-[color:var(--project-ui-color-19)]"
      }
    >
      {isStaff ? dictionary.links.internal : dictionary.people.client}
    </ProjectPill>
  );
}

export function ProjectLinksCard({
  projectId, canCreateItems, canManageItems }: ProjectLinksCardProps) {
  const client = useProjectsUiClient();
  const dictionary = useProjectsUiDictionary();
  const router = useRouter();
  const links = useProjectDetailLinks();
  const { applyLinksPayload } = useProjectDetailActions();
  const [editingLink, setEditingLink] = useState<ProjectLink | null>(null);
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [isDeletingLink, setIsDeletingLink] = useState(false);
  const [isLinkDeleteDialogOpen, setLinkDeleteDialogOpen] = useState(false);
  const [linkMode, setLinkMode] = useState<SheetMode>("view");
  const [linkEditBaseline, setLinkEditBaseline] = useState<LinkFormState | null>(null);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkKind, setLinkKind] = useState("other");
  const [linkVisibility, setLinkVisibility] = useState("staff");

  useEffect(() => {
    if (!editingLink) return;

    const refreshedLink = links.find((link) => link.id === editingLink.id);
    if (!refreshedLink) {
      setEditingLink(null);
      setLinkEditBaseline(null);
      setLinkMode("view");
      setLinkDeleteDialogOpen(false);
      return;
    }

    setEditingLink(refreshedLink);
    if (linkMode === "view") {
      setLinkLabel(refreshedLink.label);
      setLinkUrl(refreshedLink.url);
      setLinkKind(refreshedLink.kind);
      setLinkVisibility(refreshedLink.visibility);
    }
  }, [editingLink, linkMode, links]);

  const isLinkEditDirty = useMemo(() => {
    if (linkMode !== "edit" || !linkEditBaseline) return false;
    return (
      JSON.stringify(
        normalizeLinkForm({
          label: linkLabel,
          url: linkUrl,
          kind: linkKind,
          visibility: linkVisibility,
        }),
      ) !== JSON.stringify(normalizeLinkForm(linkEditBaseline))
    );
  }, [linkEditBaseline, linkKind, linkLabel, linkMode, linkUrl, linkVisibility]);

  const openEditLink = (link: ProjectLink) => {
    setLinkMode("view");
    setLinkEditBaseline(null);
    setEditingLink(link);
    setLinkLabel(link.label);
    setLinkUrl(link.url);
    setLinkKind(link.kind);
    setLinkVisibility(link.visibility);
  };

  const submitLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingLink || linkMode !== "edit" || isSavingLink || !linkLabel.trim() || !linkUrl.trim() || !isLinkEditDirty) return;
    const normalizedLinkUrl = normalizeProjectLinkUrl(linkUrl);
    if (!isValidProjectLinkUrl(normalizedLinkUrl)) {
      toast.error(dictionary.create.invalidUrl);
      return;
    }
    setIsSavingLink(true);

    try {
      setLinkUrl(normalizedLinkUrl);
      const response = await client.requestRaw(`/api/projects/${projectId}/links/${editingLink.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: linkLabel,
          url: normalizedLinkUrl,
          kind: linkKind,
          visibility: linkVisibility,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : dictionary.links.updateError;
        throw new Error(message);
      }
      const didApplyLinks = applyLinksPayload(payload);

      toast.success(dictionary.links.updated);
      setEditingLink(null);
      setLinkEditBaseline(null);
      setLinkMode("view");
      if (!didApplyLinks) {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.links.updateFallbackError);
    } finally {
      setIsSavingLink(false);
    }
  };

  const deleteLink = async () => {
    if (!editingLink || isDeletingLink) return;
    setIsDeletingLink(true);
    try {
      const response = await client.requestRaw(`/api/projects/${projectId}/links/${editingLink.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : dictionary.links.deleteError;
        throw new Error(message);
      }
      const didApplyLinks = applyLinksPayload(payload);

      toast.success(dictionary.links.deleted);
      setLinkDeleteDialogOpen(false);
      setEditingLink(null);
      setLinkEditBaseline(null);
      setLinkMode("view");
      if (!didApplyLinks) {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.links.deleteFallbackError);
    } finally {
      setIsDeletingLink(false);
    }
  };

  return (
    <TooltipProvider>
      <>
        <ProjectSurfaceCard className="self-start">
          <ProjectSurfaceSectionHeader
            icon={Link2}
        title={dictionary.links.keyLinks}
            subtitle="Atalhos para recursos importantes"
            rightSlot={
              canCreateItems ? (
                <SectionAddButton
              label={dictionary.links.addLink}
                  onClick={() => dispatchProjectsEvent(PROJECTS_EVENTS.openNewLink)}
                />
              ) : null
            }
          />
          <div className="portal-scroll mt-4 h-[17.75rem] rounded-[var(--radius-card)] border border-[color:var(--border)]">
            {links.length === 0 ? <LinksEmptyState /> : null}
            {links.map((link) => {
              const kindConfig = getLinkKindConfig(link.kind);
              const hostname = safeGetHostname(link.url);
              const KindIcon = kindConfig.icon;
              return (
                <div
                  key={link.id}
                  className="group relative flex min-h-[3.25rem] items-center border-t border-[color:var(--border)] transition-colors first:border-t-0 hover:bg-[color:var(--project-ui-color-09)]"
                >
                  {/* The whole row opens the resource. */}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir ${link.label}`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-1.5"
                  >
                    <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", kindConfig.iconBgClass)}>
                      <KindIcon className={cn("size-4", kindConfig.iconClass)} />
                    </div>
                    <div className="min-w-0 flex-1 py-0.5 transition-[padding] duration-200 group-focus-within:pr-[5.25rem] group-hover:pr-[5.25rem]">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="portal-body min-w-0 flex-1 truncate font-semibold leading-snug">{link.label}</p>
                        <LinkVisibilityPill visibility={link.visibility} />
                      </div>
                      <div className="portal-meta mt-0.5 flex min-w-0 items-center gap-x-2">
                        <span className="shrink-0">{kindConfig.label}</span>
                        {hostname ? (
                          <>
                            <span className="text-foreground/25">·</span>
                            <span className="truncate">{hostname}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </a>
                  <div className="pointer-events-none absolute right-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
                    {canManageItems ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="pointer-events-auto size-8 rounded-full text-foreground/45 transition hover:bg-[color:var(--muted)] hover:text-foreground"
                            onClick={() => openEditLink(link)}
                          >
                            <PencilLine className="size-4" />
                            <span className="sr-only">{dictionary.forms.editLink}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">{dictionary.forms.editLink}</TooltipContent>
                      </Tooltip>
                    ) : null}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Abrir ${link.label}`}
                      className="pointer-events-auto flex size-8 items-center justify-center rounded-full text-foreground/45 transition hover:bg-[color:var(--muted)] hover:text-foreground"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </ProjectSurfaceCard>

        <Sheet
          open={Boolean(editingLink)}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setEditingLink(null);
              setLinkEditBaseline(null);
              setLinkMode("view");
              setLinkDeleteDialogOpen(false);
            }
          }}
        >
          <SheetContent className={sheetShellClassName}>
            <AppSheetHeader
              icon={Link2}
              editing={linkMode !== "view"}
              eyebrow={linkMode === "view" ? dictionary.board.viewEyebrow : dictionary.board.editEyebrow}
              title={<>{linkMode === "view" ? (linkLabel.trim() || dictionary.links.kinds.other) : dictionary.forms.editLink}</>}
              description={<>{linkMode === "view" ? (linkUrl.trim() || dictionary.links.noUrl) : dictionary.links.editDescription}</>}
            />

            <form onSubmit={submitLink} className="flex min-h-0 flex-1 flex-col">
              <div className={`${sheetBodyClassName} space-y-4`}>
                <SheetSection title={dictionary.links.kinds.other} editing={linkMode !== "view"} bodyClassName="space-y-3 px-4 py-3">
                <label className={cn("mt-0 block", sheetFieldLabelClassName)}>
                    {dictionary.forms.name}
                  <Input
                    value={linkLabel}
                    onChange={(event) => setLinkLabel(event.target.value)}
                    disabled={linkMode === "view"}
                    required
                    className={cn(linkMode === "view" ? sheetViewControlClassName : sheetEditControlClassName, "mt-1.5")}
                  />
                </label>
                <label className={cn("mt-0 block", sheetFieldLabelClassName)}>
                    {dictionary.forms.url}
                  <Input
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    onBlur={(event) => setLinkUrl(normalizeProjectLinkUrl(event.target.value))}
                    disabled={linkMode === "view"}
                    required
                    placeholder="https://"
                    className={cn(linkMode === "view" ? sheetViewControlClassName : sheetEditControlClassName, "mt-1.5")}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={cn("mt-0 block", sheetFieldLabelClassName)}>
                    {dictionary.forms.kind}
                    <select
                      value={linkKind}
                      onChange={(event) => setLinkKind(event.target.value)}
                      disabled={linkMode === "view"}
                      className={cn(linkMode === "view" ? sheetViewControlClassName : sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                    >
                      <option value="other">{dictionary.create.linkKinds.other}</option>
                      <option value="doc">{dictionary.create.linkKinds.doc}</option>
                      <option value="sheet">{dictionary.create.linkKinds.sheet}</option>
                      <option value="drive">{dictionary.create.linkKinds.drive}</option>
                    </select>
                  </label>
                  <label className={cn("mt-0 block", sheetFieldLabelClassName)}>
                    {dictionary.forms.visibility}
                    <select
                      value={linkVisibility}
                      onChange={(event) => setLinkVisibility(event.target.value)}
                      disabled={linkMode === "view"}
                      className={cn(linkMode === "view" ? sheetViewControlClassName : sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                    >
                      <option value="staff">{dictionary.create.internalTeam}</option>
                      <option value="client">{dictionary.people.client}</option>
                    </select>
                  </label>
                </div>
                </SheetSection>
                {linkMode === "edit" ? (
                  <Button
                    type="button"
                    variant="link"
                    size="link"
                    className="w-fit p-0 text-sm text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                    onClick={() => setLinkDeleteDialogOpen(true)}
                    disabled={isDeletingLink || isSavingLink}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      {dictionary.links.deleteLink}
                  </Button>
                ) : null}
              </div>
              <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
                {linkMode === "view" ? (
                  canManageItems ? (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => {
                        setLinkEditBaseline({
                          label: linkLabel,
                          url: linkUrl,
                          kind: linkKind,
                          visibility: linkVisibility,
                        });
                        setLinkMode("edit");
                      }}
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      {dictionary.forms.editLink}
                    </Button>
                  ) : null
                ) : (
                  <>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isSavingLink || !linkLabel.trim() || !linkUrl.trim() || !isLinkEditDirty}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isSavingLink ? dictionary.actions.saving : dictionary.actions.save}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={isSavingLink}
                      onClick={() => {
                        if (linkEditBaseline) {
                          setLinkLabel(linkEditBaseline.label);
                          setLinkUrl(linkEditBaseline.url);
                          setLinkKind(linkEditBaseline.kind);
                          setLinkVisibility(linkEditBaseline.visibility);
                        }
                        setLinkMode("view");
                      }}
                    >
                      {dictionary.actions.cancel}
                    </Button>
                  </>
                )}
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>

        <AlertDialog open={isLinkDeleteDialogOpen} onOpenChange={setLinkDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{dictionary.links.deleteTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {dictionary.links.deleteDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingLink}>{dictionary.actions.cancel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteLink}
                disabled={isDeletingLink}
                className="bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/60"
              >
                {isDeletingLink ? dictionary.editItems.deleting : dictionary.links.deleteLink}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </TooltipProvider>
  );
}
