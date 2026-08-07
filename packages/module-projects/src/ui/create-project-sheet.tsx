"use client";

import { StyledSelect } from "@brightweblabs/ui";

import { useProjectsUiClient, useProjectsUiDictionary } from "./context";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FolderKanban, Loader2, Plus, Save, Users2 } from "lucide-react";
import { toast } from "sonner";
import {
  sheetBodyClassName,
  sheetFooterClassName,
  sheetShellClassName,
} from "./constants";
import { PROJECTS_EVENTS, dispatchProjectsEvent } from "./events";
import { AppSheetHeader, SheetSection } from "./shared/app-sheet";
import {
  FormSection,
  DateField,
  SelectField,
} from "./project-create/shared-fields";
import {
  sheetAccentTextareaClassName,
  sheetEditControlClassName,
  sheetFieldLabelClassName,
} from "./shared/sheet-section";
import { cn } from "./utils";
import { Checkbox, SearchField } from "@brightweblabs/ui";
import { OrganizationCreateSheet, type OrganizationCreateSheetInput } from "@brightweblabs/module-orgs/ui";
import { PROJECT_MEMBER_SCOPE_LABELS, useProjectSetupState } from "./project-create/use-project-setup-state";
import { useProjectFormState } from "./project-create/use-project-form-state";
import { createProject } from "./project-ui-actions";
import { parseProjectBoardApiError } from "./project-board-response-parser";
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
import { Field, FieldContent, FieldGroup, FieldLabel } from "@brightweblabs/ui";
import { Input } from "@brightweblabs/ui";
import {
  Sheet,
  SheetContent,
  SheetFooter,
} from "@brightweblabs/ui";
import { PROJECT_MEMBER_ROLE_LABELS_PT, type ProjectMemberRole } from "../contracts";
import { SheetSelect, useShellAction } from "@brightweblabs/app-shell";


type OrganizationOption = {
  id: string;
  name: string;
};

type CreateProjectSheetProps = {
  organizations: OrganizationOption[];
  initialOpen?: boolean;
};

export function CreateProjectSheet({ organizations, initialOpen = false }: CreateProjectSheetProps) {
  const client = useProjectsUiClient();
  const dictionary = useProjectsUiDictionary();
  const [open, setOpen] = useState(initialOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizationSheetOpen, setOrganizationSheetOpen] = useState(false);
  const [organizationOptions, setOrganizationOptions] = useState<OrganizationOption[]>(organizations);
  const [organizationsLoadState, setOrganizationsLoadState] = useState<"idle" | "pending" | "fulfilled" | "rejected">(organizations.length > 0 ? "fulfilled" : "idle");
  const organizationsRequestRef = useRef<AbortController | null>(null);

  const projectForm = useProjectFormState(organizationOptions);
  const setup = useProjectSetupState();

  const hasOrganizations = organizationOptions.length > 0;
  const isLoadingOrganizations = organizationsLoadState === "pending";

  const [isProjectDiscardDialogOpen, setProjectDiscardDialogOpen] = useState(false);

  // Has the user written anything worth confirming before closing the project
  // sheet? The pre-selected organization isn't user input, so it doesn't count.
  const isProjectDirty = useMemo(
    () =>
      Boolean(
          projectForm.name.trim() ||
          projectForm.summary.trim() ||
          projectForm.startDate ||
          projectForm.targetDate ||
          projectForm.cancellationReason.trim() ||
          projectForm.codeTouched ||
          projectForm.status !== "planned",
      ),
    [
      projectForm.cancellationReason,
      projectForm.codeTouched,
      projectForm.name,
      projectForm.status,
      projectForm.startDate,
      projectForm.summary,
      projectForm.targetDate,
    ],
  );

  const performProjectCancel = useCallback(() => {
    setOpen(false);
  }, []);

  const handleProjectCancel = useCallback(() => {
    if (isProjectDirty) {
      setProjectDiscardDialogOpen(true);
      return;
    }
    performProjectCancel();
  }, [isProjectDirty, performProjectCancel]);

  useShellAction(PROJECTS_EVENTS.openNewProject, () => {
    setOpen(true);
  });

  const loadOrganizations = useCallback(async () => {
    if (organizationsLoadState !== "idle") return;

    organizationsRequestRef.current?.abort();
    const controller = new AbortController();
    organizationsRequestRef.current = controller;
    setOrganizationsLoadState("pending");
    try {
      const nextOrganizations = await client.listOrganizations({ signal: controller.signal });
      if (organizationsRequestRef.current !== controller) return;

      setOrganizationOptions(nextOrganizations);
      if (!projectForm.organizationId && nextOrganizations[0]?.id) {
        projectForm.setOrganizationId(nextOrganizations[0].id);
      }
      setOrganizationsLoadState("fulfilled");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setOrganizationsLoadState("rejected");
      toast.error(error instanceof Error ? error.message : dictionary.projectCreate.loadOrganizationsError);
    } finally {
      if (organizationsRequestRef.current === controller) organizationsRequestRef.current = null;
    }
  }, [client, dictionary.projectCreate.loadOrganizationsError, organizationsLoadState, projectForm]);

  useEffect(() => () => organizationsRequestRef.current?.abort(), []);

  useEffect(() => {
    if (!open) {
      organizationsRequestRef.current?.abort();
      organizationsRequestRef.current = null;
      if (organizationsLoadState === "pending" || organizationsLoadState === "rejected") setOrganizationsLoadState("idle");
      return;
    }
    void loadOrganizations();
  }, [loadOrganizations, open, organizationsLoadState]);

  useEffect(() => {
    if (open) return;
    setOrganizationSheetOpen(false);
  }, [open]);

  const handleCreateOrganization = async (input: OrganizationCreateSheetInput) => {
      const response = await client.requestRaw("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage = parseProjectBoardApiError(payload, dictionary.projectCreate.createOrganizationError);
        throw new Error(errorMessage);
      }

      const created = payload?.data?.organization as OrganizationOption | undefined;
      const inviteSummary = payload?.data?.inviteSummary as
        | {
          pendingInvitations?: number;
          directAssignments?: number;
          updatedExistingMembers?: number;
          failedEmailDeliveries?: number;
        }
        | undefined;
      if (!created?.id || !created?.name) {
        throw new Error(dictionary.projectCreate.invalidOrganizationResponse);
      }

      const nextOrganizations = [...organizationOptions.filter((organization) => organization.id !== created.id), created]
        .toSorted((a, b) => a.name.localeCompare(b.name, "pt-PT"));
      setOrganizationOptions(nextOrganizations);
      projectForm.setOrganizationId(created.id);
      projectForm.setCodeTouched(false);
      const pendingCount = inviteSummary?.pendingInvitations ?? 0;
      const directCount = (inviteSummary?.directAssignments ?? 0) + (inviteSummary?.updatedExistingMembers ?? 0);
      if (input.invitations.length > 0) {
        const failedEmailCount = inviteSummary?.failedEmailDeliveries ?? 0;
        toast.success(dictionary.projectCreate.organizationCreatedWithInvites(pendingCount, directCount));
        if (failedEmailCount > 0) {
          toast.error(dictionary.projectCreate.inviteEmailFailed(failedEmailCount));
        }
      } else {
        toast.success(dictionary.projectCreate.organizationCreated);
      }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectForm.isFormValid || isSubmitting) return;
    if (projectForm.status === "canceled" && !projectForm.cancellationReason.trim()) {
      toast.error("Indica o motivo do cancelamento.");
      return;
    }

    setIsSubmitting(true);
    try {
      const createdProject = await createProject(client, {
        organizationId: projectForm.organizationId,
        name: projectForm.name,
        code: projectForm.code.trim() || undefined,
        status: projectForm.status,
        startDate: projectForm.startDate || undefined,
        targetDate: projectForm.targetDate || undefined,
        cancellationReason: projectForm.cancellationReason.trim() || undefined,
        summary: projectForm.summary.trim() || undefined,
      });

      toast.success(dictionary.projectCreate.projectCreated);
      setOpen(false);
      projectForm.resetProjectForm(organizationOptions);
      setup.setSetupOpen(true);
      await setup.loadSetupData(
        createdProject.id,
        typeof createdProject.name === "string" ? createdProject.name : projectForm.name,
        createdProject.ownerProfileId,
      );
      dispatchProjectsEvent(PROJECTS_EVENTS.refresh);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.projectCreate.projectCreateFallbackError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!setup.setupState || setup.savingSetup) return;

    setup.setSavingSetup(true);
    try {
      let membersPayload = Object.entries(setup.setupState.members).map(([profileId, role]) => ({ profileId, role }));
      const ownerCandidates = membersPayload.filter((member) => member.role === "owner");
      if (ownerCandidates.length > 1) {
        const ownerLabelByProfileId = new Map(setup.memberOptions.map((member) => [member.profileId, member.label]));
        const optionsText = ownerCandidates
          .map((member, index) => `${index + 1}. ${ownerLabelByProfileId.get(member.profileId) ?? member.profileId}`)
          .join("\n");
        const selectedRaw = window.prompt(
          dictionary.projectCreate.chooseOwner(optionsText),
          "1",
        );

        if (selectedRaw === null) {
          setup.setSavingSetup(false);
          return;
        }

        const selectedIndex = Number.parseInt(selectedRaw, 10) - 1;
        if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex >= ownerCandidates.length) {
          throw new Error(dictionary.projectCreate.invalidSelection);
        }

        const selectedOwnerProfileId = ownerCandidates[selectedIndex]?.profileId;
        if (!selectedOwnerProfileId) {
          throw new Error(dictionary.projectCreate.ownerValidationError);
        }

        membersPayload = membersPayload.map((member) => (
          member.role === "owner" && member.profileId !== selectedOwnerProfileId
            ? { ...member, role: "contributor" as const }
            : member
        ));
      }

      const ownerEntry = membersPayload.find((member) => member.role === "owner");
      const ownerProfileId = ownerEntry?.profileId ?? null;

      const [projectResponse, membersResponse] = await Promise.all([
        client.requestRaw(`/api/projects/${setup.setupState.projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerProfileId,
          }),
        }),
        client.requestRaw(`/api/projects/${setup.setupState.projectId}/members`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ members: membersPayload }),
        }),
      ]);

      const projectPayload = await projectResponse.json();
      if (!projectResponse.ok) {
        const message = parseProjectBoardApiError(projectPayload, dictionary.projectCreate.saveDetailsError);
        throw new Error(message);
      }

      const membersPayloadResponse = await membersResponse.json();
      if (!membersResponse.ok) {
        const message = parseProjectBoardApiError(membersPayloadResponse, dictionary.projectCreate.saveTeamError);
        throw new Error(message);
      }

      toast.success(dictionary.projectCreate.setupSaved);
      setup.closeSetupSheet();
      dispatchProjectsEvent(PROJECTS_EVENTS.refresh);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.projectCreate.setupSaveError);
    } finally {
      setup.setSavingSetup(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => { if (next) setOpen(true); else handleProjectCancel(); }}>
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader
            icon={FolderKanban}
            editing
            eyebrow={dictionary.create.creatingEyebrow}
            title={<>{dictionary.forms.newProject}</>}
            description={<>{dictionary.projectCreate.description}</>}
          />

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-0">
            <div className={`${sheetBodyClassName} space-y-4`}>
              <FormSection title={dictionary.projectCreate.context}>
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel className={sheetFieldLabelClassName}>{dictionary.forms.organization}</FieldLabel>
                  <FieldContent>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <SheetSelect
                        id="project-organization"
                        value={projectForm.organizationId}
                        onValueChange={projectForm.setOrganizationId}
                        disabled={!hasOrganizations || isLoadingOrganizations}
                        options={isLoadingOrganizations
                          ? [{ value: "", label: dictionary.projectCreate.loadingOrganizations }]
                          : organizationsLoadState === "rejected"
                            ? [{ value: "", label: dictionary.projectCreate.loadOrganizationsError }]
                            : hasOrganizations
                              ? organizationOptions.map((organization) => ({ value: organization.id, label: organization.name }))
                              : [{ value: "", label: dictionary.projectCreate.noOrganizations }]}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-9 shrink-0 rounded-lg"
                        aria-label={dictionary.projectCreate.newOrganization}
                        title={dictionary.projectCreate.newOrganization}
                        onClick={() => setOrganizationSheetOpen(true)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    {isLoadingOrganizations ? (
                      <p className="mt-1 text-micro text-foreground/55">{dictionary.projectCreate.loadingOrganizations}</p>
                    ) : organizationsLoadState === "rejected" ? (
                      <p role="alert" className="mt-1 text-micro text-destructive">{dictionary.projectCreate.loadOrganizationsError}</p>
                    ) : !hasOrganizations ? (
                      <p className="mt-1 text-micro text-foreground/55">{dictionary.projectCreate.createOrganizationToContinue}</p>
                    ) : null}
                  </FieldContent>
                </Field>
              </FormSection>

              <FormSection title={dictionary.board.contentSection}>
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel className={sheetFieldLabelClassName}>{dictionary.projectCreate.projectName}</FieldLabel>
                  <FieldContent>
                    <Input
                      id="project-name"
                      value={projectForm.name}
                      onChange={(event) => projectForm.setName(event.target.value)}
                      required
                      className={cn(sheetEditControlClassName, "mt-1.5")}
                    />
                  </FieldContent>
                </Field>
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel className={sheetFieldLabelClassName}>{dictionary.projectCreate.optionalCode}</FieldLabel>
                  <FieldContent>
                    <Input
                      id="project-code"
                      value={projectForm.code}
                      onChange={(event) => {
                        projectForm.setCode(event.target.value);
                        projectForm.setCodeTouched(true);
                      }}
                      className={cn(sheetEditControlClassName, "mt-1.5")}
                    />
                    <p className="mt-0.5 text-micro text-foreground/55">{dictionary.projectCreate.generatedCodeHint}</p>
                  </FieldContent>
                </Field>
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel className={sheetFieldLabelClassName}>{dictionary.forms.summary}</FieldLabel>
                  <FieldContent>
                    <textarea
                      id="project-summary"
                      rows={3}
                      className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)}
                      value={projectForm.summary}
                      onChange={(event) => projectForm.setSummary(event.target.value)}
                      placeholder={dictionary.projectEdit.summaryPlaceholder}
                    />
                  </FieldContent>
                </Field>
              </FormSection>

              <FormSection title={dictionary.board.executionSection}>
                <SelectField
                  id="project-status"
                  label={dictionary.forms.status}
                  value={projectForm.status}
                  onChange={(nextStatus) => {
                    projectForm.setStatus(nextStatus);
                    if (nextStatus !== "canceled") projectForm.setCancellationReason("");
                  }}
                >
                  <option value="planned">{dictionary.badge.status.planned}</option>
                  <option value="active">{dictionary.badge.status.active}</option>
                  <option value="blocked">{dictionary.badge.status.blocked}</option>
                  <option value="completed">{dictionary.badge.status.completed}</option>
                  <option value="canceled">{dictionary.badge.status.canceled}</option>
                </SelectField>
                {projectForm.status === "canceled" ? (
                  <Field className="gap-1.5 px-4 py-2">
                    <FieldLabel className={sheetFieldLabelClassName}>{dictionary.projectEdit.cancellationReasonLabel}</FieldLabel>
                    <FieldContent>
                      <textarea
                        id="project-cancellation-reason"
                        rows={3}
                        className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)}
                        value={projectForm.cancellationReason}
                        onChange={(event) => projectForm.setCancellationReason(event.target.value)}
                        placeholder={dictionary.projectEdit.cancellationPlaceholder}
                      />
                    </FieldContent>
                  </Field>
                ) : null}
              </FormSection>

              <FormSection title={dictionary.board.calendarSection}>
                <div className="grid gap-0 sm:grid-cols-2">
                  <DateField
                    id="project-start-date"
                    label={dictionary.projectEdit.startDate}
                    value={projectForm.startDate}
                    onChange={projectForm.setStartDate}
                  />
                  <DateField
                    id="project-target-date"
                    label={dictionary.projectEdit.targetDate}
                    value={projectForm.targetDate}
                    onChange={projectForm.setTargetDate}
                  />
                </div>
                {!projectForm.isDateRangeValid ? <p role="alert" className="px-4 pb-2 text-meta text-semantic-danger-strong">{dictionary.projectEdit.invalidDateRange}</p> : null}
              </FormSection>
            </div>

            <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
              <Button type="submit" className="flex-1" disabled={!hasOrganizations || !projectForm.isFormValid || isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? dictionary.create.creating : dictionary.projectCreate.createProject}
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={handleProjectCancel} disabled={isSubmitting}>
                {dictionary.actions.cancel}
              </Button>
            </SheetFooter>
          </form>

          <OrganizationCreateSheet
            open={organizationSheetOpen}
            onOpenChange={setOrganizationSheetOpen}
            onSubmit={handleCreateOrganization}
            dictionary={{
              eyebrow: dictionary.create.creatingEyebrow,
              title: dictionary.projectCreate.newOrganization,
              description: dictionary.projectCreate.organizationDescription,
              identity: dictionary.projectCreate.identification,
              name: dictionary.forms.name,
              industry: dictionary.projectCreate.industry,
              selectIndustry: dictionary.projectCreate.selectIndustry,
              website: dictionary.projectCreate.website,
              taxIdentifier: dictionary.projectCreate.taxIdentifier,
              location: dictionary.projectCreate.address,
              address: dictionary.projectCreate.line1,
              addressLine2: dictionary.projectCreate.line2,
              addressLine2Placeholder: dictionary.projectCreate.line2Placeholder,
              zipCode: dictionary.projectCreate.zipCode,
              country: dictionary.projectCreate.country,
              profile: dictionary.projectCreate.profile,
              companySize: dictionary.projectCreate.companySize,
              budgetRange: dictionary.projectCreate.budget,
              members: dictionary.projectCreate.members,
              member: dictionary.people.member,
              admin: dictionary.projectCreate.admin,
              add: dictionary.projectCreate.add,
              remove: dictionary.projectCreate.remove,
              optionalInvites: dictionary.projectCreate.optionalInvites,
              inviteHint: dictionary.projectCreate.primaryContactHint,
              invalidEmail: dictionary.projectCreate.invalidInviteEmail,
              create: dictionary.projectCreate.createOrganization,
              creating: dictionary.create.creating,
              cancel: dictionary.actions.cancel,
              createError: dictionary.projectCreate.organizationCreateFallbackError,
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={setup.setupOpen} onOpenChange={(next) => { if (!next && !setup.savingSetup) setup.closeSetupSheet(); }}>
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader
            icon={Users2}
            editing
            eyebrow={dictionary.board.editEyebrow}
            title={<>{dictionary.projectCreate.configureTeam}</>}
            description={<>{setup.setupState?.projectName ? dictionary.projectCreate.projectNamePrefix(setup.setupState.projectName) : dictionary.projectCreate.defineTeam}</>}
          />

          {setup.loadingSetupData || !setup.setupState ? (
            <div className={`${sheetBodyClassName} flex items-center justify-center py-12`}>
              <p className="inline-flex items-center gap-2 text-body text-foreground/70">
                <Loader2 className="size-4 animate-spin" />
                {dictionary.projectCreate.preparing}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSaveSetup} className="flex min-h-0 flex-1 flex-col gap-0">
              <div className={`${sheetBodyClassName} space-y-4`}>
                <SheetSection title={dictionary.projectCreate.projectTeam} editing>
                  <FieldGroup className="gap-0 px-0 py-1">
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel className={sheetFieldLabelClassName}>{dictionary.projectCreate.teamInProject}</FieldLabel>
                      <FieldContent>
                        <div className="mt-1">
                          <SearchField
                            size="sm"
                            value={setup.memberSearch}
                            onChange={setup.setMemberSearch}
                            onClear={() => setup.setMemberSearch("")}
                            placeholder={dictionary.projectCreate.searchByName}
                          />
                        </div>
                        <div className="mt-1 space-y-2">
                          {setup.memberOptions.length === 0 ? <p className="text-meta text-foreground/60">{dictionary.projectCreate.noUsers}</p> : null}
                          {setup.memberOptions.length > 0 && setup.filteredMemberOptions.length === 0 ? <p className="text-meta text-foreground/60">{dictionary.projectCreate.noSearchResults}</p> : null}
                          {setup.filteredMemberOptions.map((member) => {
                            const selectedRole = setup.setupState?.members[member.profileId];
                            return (
                              <div key={member.profileId} className="flex items-center gap-2 rounded-xl border border-black/8 bg-background/70 px-3 py-2 dark:border-white/10">
                                <Checkbox
                                  id={`member-${member.profileId}`}
                                  className="size-4 accent-primary"
                                  checked={Boolean(selectedRole)}
                                  onChange={() => setup.toggleMember(member.profileId)}
                                />
                                <label htmlFor={`member-${member.profileId}`} className="min-w-0 flex-1 text-body">
                                  <span className="block truncate font-semibold text-foreground">{member.label}</span>
                                  <span className="block truncate text-meta text-foreground/60">
                                    {member.email ?? dictionary.people.noEmail} · {PROJECT_MEMBER_SCOPE_LABELS[member.organizationRole]}
                                  </span>
                                </label>
                                <StyledSelect
                                  className="h-7 rounded-md border border-black/10 bg-background px-2 text-meta dark:border-white/10"
                                  value={selectedRole ?? "contributor"}
                                  onChange={(event) => setup.setMemberRole(member.profileId, event.target.value as ProjectMemberRole)}
                                >
                                  <option value="owner">{PROJECT_MEMBER_ROLE_LABELS_PT.owner}</option>
                                  <option value="contributor">{PROJECT_MEMBER_ROLE_LABELS_PT.contributor}</option>
                                  <option value="observer">{PROJECT_MEMBER_ROLE_LABELS_PT.observer}</option>
                                </StyledSelect>
                              </div>
                            );
                          })}
                        </div>
                      </FieldContent>
                    </Field>
                  </FieldGroup>
                </SheetSection>
              </div>

              <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
                <Button type="submit" className="flex-1" disabled={setup.savingSetup}>
                  <Save className="mr-2 h-4 w-4" />
                  {setup.savingSetup ? dictionary.actions.saving : dictionary.projectCreate.saveConfiguration}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={setup.closeSetupSheet}
                  disabled={setup.savingSetup}
                >
                  {dictionary.projectCreate.finishLater}
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={isProjectDiscardDialogOpen} onOpenChange={setProjectDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dictionary.projectCreate.discardTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {dictionary.projectCreate.discardDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{dictionary.projectCreate.continueEditing}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                setProjectDiscardDialogOpen(false);
                performProjectCancel();
              }}
            >
              {dictionary.projectCreate.discard}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
