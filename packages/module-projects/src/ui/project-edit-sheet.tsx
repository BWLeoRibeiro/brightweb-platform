"use client";

import { useProjectsUiClient, useProjectsUiDictionary } from "./context";
import { useProjectsNavigation } from "./context";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { CalendarIcon, FolderKanban, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  sheetBodyClassName,
  sheetFooterClassName,
  sheetShellClassName,
} from "./constants";
import { AppSheetHeader, SheetSection } from "./shared/app-sheet";
import { useOptionalProjectDetailActions, useOptionalProjectDetailData } from "./project-detail-data-provider";
import { PROJECTS_EVENTS } from "./events";
import {
  sheetEditControlClassName,
  sheetFieldLabelClassName,
  sheetViewControlClassName,
} from "./shared/sheet-section";
import { cn } from "./utils";
import { Button } from "@brightweblabs/ui";
import { Calendar } from "@brightweblabs/ui";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@brightweblabs/ui";
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
import { Input } from "@brightweblabs/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@brightweblabs/ui";
import { Sheet, SheetContent, SheetFooter } from "@brightweblabs/ui";

type ProjectRole = "admin" | "owner" | "contributor" | "observer";

type ProjectEditInitial = {
  name: string;
  code: string | null;
  status: string;
  targetDate: string | null;
  cancellationReason: string | null;
  summary: string | null;
};

type ProjectEditSheetProps = {
  projectId: string;
  initial?: ProjectEditInitial;
  initialOpen?: boolean;
};

type FormState = {
  name: string;
  code: string;
  status: string;
  targetDate: string;
  cancellationReason: string;
  summary: string;
};

function toFormState(initial: ProjectEditInitial): FormState {
  return {
    name: initial.name,
    code: initial.code ?? "",
    status: initial.status,
    targetDate: initial.targetDate ?? "",
    cancellationReason: initial.cancellationReason ?? "",
    summary: initial.summary ?? "",
  };
}

const allEditableFields = ["name", "code", "status", "targetDate", "cancellationReason", "summary"] as const;
const contributorEditableFields = ["summary", "targetDate"] as const;

function toIsoDate(value?: Date): string {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function ProjectEditSheet({
  projectId, initial: initialProp, initialOpen = false }: ProjectEditSheetProps) {
  const client = useProjectsUiClient();
  const dictionary = useProjectsUiDictionary();
  const navigation = useProjectsNavigation();
  const router = useRouter();
  const detailData = useOptionalProjectDetailData();
  const detailActions = useOptionalProjectDetailActions();
  const project = detailData?.project;
  const initial = useMemo<ProjectEditInitial>(() => {
    if (project) {
      return {
        name: project.name,
        code: project.code,
        status: project.status,
        targetDate: project.targetDate,
        cancellationReason: project.cancellationReason,
        summary: project.summary,
      };
    }

    return {
      name: initialProp?.name ?? "",
      code: initialProp?.code ?? null,
      status: initialProp?.status ?? "planned",
      targetDate: initialProp?.targetDate ?? null,
      cancellationReason: initialProp?.cancellationReason ?? null,
      summary: initialProp?.summary ?? null,
    };
  }, [
    initialProp?.cancellationReason,
    initialProp?.code,
    initialProp?.name,
    initialProp?.status,
    initialProp?.summary,
    initialProp?.targetDate,
    project?.cancellationReason,
    project?.code,
    project?.name,
    project?.status,
    project?.summary,
    project?.targetDate,
  ]);
  const [open, setOpen] = useState(initialOpen);
  const [role, setRole] = useState<ProjectRole | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => toFormState(initial));

  useEffect(() => {
    setForm(toFormState(initial));
  }, [initial]);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(PROJECTS_EVENTS.openEditProject, handleOpen);
    return () => window.removeEventListener(PROJECTS_EVENTS.openEditProject, handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    const controller = new AbortController();

    const run = async () => {
      setIsLoadingRole(true);
      try {
        const response = await client.requestRaw(`/api/projects/${projectId}/access`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : dictionary.projectEdit.permissionError);
        if (!isMounted) return;
        const nextRole = payload?.data?.projectRole;
        if (nextRole === "admin" || nextRole === "owner" || nextRole === "contributor" || nextRole === "observer") {
          setRole(nextRole);
        } else {
          setRole("observer");
        }
      } catch (error) {
        if (!isMounted) return;
        setRole("observer");
        toast.error(error instanceof Error ? error.message : dictionary.projectEdit.validatePermissionError);
      } finally {
        if (isMounted) setIsLoadingRole(false);
      }
    };

    void run();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [open, projectId]);

  const editableFields = useMemo(() => {
    if (role === "admin" || role === "owner") return allEditableFields;
    if (role === "contributor") return contributorEditableFields;
    return [] as readonly string[];
  }, [role]);

  const canEditAnyField = editableFields.length > 0;
  const editing = canEditAnyField;
  const canDeleteProject = role === "admin";
  const controlClass = (field: (typeof allEditableFields)[number]) =>
    isFieldEditable(field) ? sheetEditControlClassName : sheetViewControlClassName;
  const textareaClass = (field: (typeof allEditableFields)[number]) =>
    isFieldEditable(field)
      ? "w-full rounded-xl border border-[color:var(--project-ui-color-01)] bg-[color:var(--card)] px-3 py-2 text-sm text-foreground placeholder:text-foreground/35 focus:border-[color:var(--accent)] focus:outline-none focus:ring-[3px] focus:ring-[color:var(--project-ui-color-10)] disabled:cursor-not-allowed disabled:opacity-55"
      : "w-full resize-none bg-transparent p-0 text-sm text-foreground placeholder:text-foreground/35 disabled:opacity-100";
  const targetDateValue = useMemo(() => parseIsoDate(form.targetDate), [form.targetDate]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const isFieldEditable = (field: (typeof allEditableFields)[number]) => editableFields.includes(field);

  const handleSave = async () => {
    if (!canEditAnyField || isSaving) return;
    if (form.status === "canceled" && !form.cancellationReason.trim()) {
      toast.error("Indica o motivo do cancelamento.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (isFieldEditable("name")) payload.name = form.name;
      if (isFieldEditable("code")) payload.code = form.code;
      if (isFieldEditable("status")) payload.status = form.status;
      if (isFieldEditable("targetDate")) payload.targetDate = form.targetDate;
      if (isFieldEditable("cancellationReason")) payload.cancellationReason = form.cancellationReason;
      if (isFieldEditable("summary")) payload.summary = form.summary;

      const response = await client.requestRaw(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        const message = typeof result?.error === "string" ? result.error : dictionary.projectEdit.saveError;
        throw new Error(message);
      }
      const didApplyDashboard = detailActions?.applyDashboardPayload(result) ?? false;

      toast.success(dictionary.projectEdit.updated);
      setOpen(false);
      if (!didApplyDashboard) {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.projectEdit.saveFallbackError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteProject || isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await client.requestRaw(`/api/projects/${projectId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        const message = typeof result?.error === "string" ? result.error : dictionary.projectEdit.deleteError;
        throw new Error(message);
      }

      toast.success(dictionary.projectEdit.deleted);
      setDeleteDialogOpen(false);
      setOpen(false);
      router.push(navigation.listHref);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.projectEdit.deleteFallbackError);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className={sheetShellClassName}>
        <AppSheetHeader
          icon={FolderKanban}
          editing={editing}
          eyebrow={isLoadingRole ? undefined : editing ? dictionary.board.editEyebrow : dictionary.board.viewEyebrow}
          title={<>{dictionary.forms.editProject}</>}
          description={
            <span className="flex items-center gap-1.5">
              {isLoadingRole ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {dictionary.projectEdit.validating}
                </>
              ) : role === "observer" ? (
                dictionary.projectEdit.readOnly
              ) : (
                dictionary.projectEdit.description
              )}
            </span>
          }
        />

        <div className={`${sheetBodyClassName} space-y-4`}>
          <SheetSection title={dictionary.projectEdit.projectSection} editing={editing}>
            <FieldGroup className={cn("gap-0 px-0 py-1", !editing && "divide-y divide-black/6 dark:divide-white/8")}>
              <Field className="gap-1.5 px-4 py-2">
                <FieldLabel className={sheetFieldLabelClassName} htmlFor="project-edit-name">
                  {dictionary.forms.name}
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="project-edit-name"
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    disabled={!isFieldEditable("name")}
                    className={controlClass("name")}
                  />
                </FieldContent>
              </Field>

              <Field className="gap-1.5 px-4 py-2">
                <FieldLabel className={sheetFieldLabelClassName} htmlFor="project-edit-code">
                  {dictionary.forms.code}
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="project-edit-code"
                    value={form.code}
                    onChange={(event) => setField("code", event.target.value)}
                    disabled={!isFieldEditable("code")}
                    className={controlClass("code")}
                  />
                </FieldContent>
              </Field>

              <Field className="gap-1.5 px-4 py-2">
                <FieldLabel className={sheetFieldLabelClassName} htmlFor="project-edit-summary">
                  {dictionary.forms.summary}
                </FieldLabel>
                <FieldContent>
                  <textarea
                    id="project-edit-summary"
                    rows={4}
                    className={cn("min-h-[88px]", textareaClass("summary"))}
                    value={form.summary}
                    onChange={(event) => setField("summary", event.target.value)}
                    disabled={!isFieldEditable("summary")}
                    placeholder={dictionary.projectEdit.summaryPlaceholder}
                  />
                </FieldContent>
              </Field>

              {form.status === "canceled" ? (
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel
                    className={sheetFieldLabelClassName}
                    htmlFor="project-edit-cancellation-reason"
                  >
                    {dictionary.projectEdit.cancellationReasonLabel}
                  </FieldLabel>
                  <FieldContent>
                    <textarea
                      id="project-edit-cancellation-reason"
                      rows={3}
                      className={cn("min-h-[72px]", textareaClass("cancellationReason"))}
                      value={form.cancellationReason}
                      onChange={(event) => setField("cancellationReason", event.target.value)}
                      disabled={!isFieldEditable("cancellationReason")}
                      placeholder={dictionary.projectEdit.cancellationPlaceholder}
                    />
                  </FieldContent>
                </Field>
              ) : null}
            </FieldGroup>
          </SheetSection>

          <SheetSection title={dictionary.projectEdit.planning} editing={editing}>
            <FieldGroup className={cn("gap-0 px-0 py-1", !editing && "divide-y divide-black/6 dark:divide-white/8")}>
              <Field className="gap-1.5 px-4 py-2">
                <FieldLabel className={sheetFieldLabelClassName} htmlFor="project-edit-status">
                  {dictionary.forms.status}
                </FieldLabel>
                <FieldContent>
                  <select
                    id="project-edit-status"
                    className={cn(controlClass("status"), "text-foreground outline-none")}
                    value={form.status}
                    onChange={(event) => {
                      const nextStatus = event.target.value;
                      setField("status", nextStatus);
                      if (nextStatus !== "canceled") setField("cancellationReason", "");
                    }}
                    disabled={!isFieldEditable("status")}
                  >
                    <option value="planned">{dictionary.badge.status.planned}</option>
                    <option value="active">{dictionary.badge.status.active}</option>
                    <option value="blocked">{dictionary.badge.status.blocked}</option>
                    <option value="completed">{dictionary.badge.status.completed}</option>
                    <option value="canceled">{dictionary.badge.status.canceled}</option>
                  </select>
                </FieldContent>
              </Field>

              <Field className="gap-1.5 px-4 py-2">
                <FieldLabel className={sheetFieldLabelClassName} htmlFor="project-edit-target-date">
                  {dictionary.projectEdit.targetDate}
                </FieldLabel>
                <FieldContent>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="project-edit-target-date"
                        type="button"
                        variant="ghost"
                        disabled={!isFieldEditable("targetDate")}
                        className={cn(
                          "h-9 w-full justify-start rounded-lg px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-55",
                          isFieldEditable("targetDate")
                            ? "border border-[color:var(--project-ui-color-01)] bg-[color:var(--card)] hover:bg-[color:var(--card)]"
                            : "border-0 bg-transparent hover:bg-transparent",
                          targetDateValue ? "text-foreground" : "text-foreground/45",
                        )}
                      >
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                        {targetDateValue ? format(targetDateValue, "dd/MM/yyyy") : dictionary.create.selectDate}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        className="rounded-lg border"
                        selected={targetDateValue}
                        onSelect={(date) => setField("targetDate", toIsoDate(date))}
                        disabled={!isFieldEditable("targetDate")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </FieldContent>
              </Field>
            </FieldGroup>
          </SheetSection>

          {canDeleteProject ? (
            <div className="overflow-hidden rounded-2xl border border-rose-300/60 bg-rose-50/45 dark:border-rose-500/30 dark:bg-rose-500/10">
              <div className="bg-rose-500 px-4 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/90">{dictionary.projectEdit.dangerZone}</p>
              </div>
              <div className="space-y-3 px-4 py-3">
                <p className="text-xs text-rose-700/90 dark:text-rose-200/90">
                  {dictionary.projectEdit.dangerDescription}
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-8 rounded-lg px-3 text-xs"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isDeleting}
                >
                  {isDeleting ? dictionary.projectEdit.deleting : dictionary.projectEdit.deleteProject}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <SheetFooter className={`${sheetFooterClassName} ${editing ? "flex-row" : ""} gap-2`}>
          {editing ? (
            <>
              <Button type="button" className="flex-1" onClick={handleSave} disabled={!canEditAnyField || isSaving || isDeleting}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? dictionary.actions.saving : dictionary.actions.save}
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={isSaving || isDeleting}>
                {dictionary.actions.cancel}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(false)}>
              {dictionary.actions.close}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(next: boolean) => {
          if (!isDeleting) setDeleteDialogOpen(next);
        }}
      >
        <AlertDialogContent className="max-w-[430px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{dictionary.projectEdit.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {dictionary.projectEdit.deleteDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-full border-black/10 px-4 text-xs dark:border-white/15"
              disabled={isDeleting}
            >
              {dictionary.actions.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-rose-600 px-4 text-xs text-white hover:bg-rose-700"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? dictionary.projectEdit.deletingEllipsis : dictionary.projectEdit.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
