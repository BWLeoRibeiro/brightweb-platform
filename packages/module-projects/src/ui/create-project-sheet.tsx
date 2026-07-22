"use client";

import { useProjectsUiClient } from "./context";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, FolderKanban, Loader2, Plus, Save, Users2 } from "lucide-react";
import { toast } from "sonner";
import {
  budgetRangeOptions,
  companySizeOptions,
  industryOptions,
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
import { SearchField } from "@brightweblabs/ui";
import {
  useOrganizationCreationState,
} from "./project-create/use-organization-creation-state";
import { PROJECT_MEMBER_SCOPE_LABELS, useProjectSetupState } from "./project-create/use-project-setup-state";
import { useProjectFormState } from "./project-create/use-project-form-state";
import { createProject } from "./project-ui-actions";
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
import { useWindowEventBridge } from "./window-events";


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
  const [open, setOpen] = useState(initialOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [organizationOptions, setOrganizationOptions] = useState<OrganizationOption[]>(organizations);
  const [hasLoadedOrganizations, setHasLoadedOrganizations] = useState(organizations.length > 0);
  const [isLoadingOrganizations, setLoadingOrganizations] = useState(false);

  const projectForm = useProjectFormState(organizationOptions);
  const organizationCreation = useOrganizationCreationState();
  const setup = useProjectSetupState();
  const { resetOrganizationForm, setOrganizationSheetOpen } = organizationCreation;

  const hasOrganizations = organizationOptions.length > 0;

  const [isProjectDiscardDialogOpen, setProjectDiscardDialogOpen] = useState(false);
  const [isOrganizationDiscardDialogOpen, setOrganizationDiscardDialogOpen] = useState(false);

  // Has the user written anything worth confirming before closing the project
  // sheet? The pre-selected organization isn't user input, so it doesn't count.
  const isProjectDirty = useMemo(
    () =>
      Boolean(
        projectForm.name.trim() ||
          projectForm.summary.trim() ||
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
      projectForm.summary,
      projectForm.targetDate,
    ],
  );

  // Mirrors `isProjectDirty` for the nested "Nova organização" sheet.
  const isOrganizationDirty = useMemo(
    () =>
      Boolean(
        organizationCreation.organizationForm.name.trim() ||
          organizationCreation.organizationForm.industry ||
          organizationCreation.organizationForm.companySize ||
          organizationCreation.organizationForm.budgetRange ||
          organizationCreation.organizationForm.websiteUrl.trim() ||
          organizationCreation.organizationForm.addressLine1.trim() ||
          organizationCreation.organizationForm.addressLine2.trim() ||
          organizationCreation.organizationForm.zipCode.trim() ||
          organizationCreation.organizationForm.country.trim() ||
          organizationCreation.organizationForm.taxIdentifierValue.trim() ||
          organizationCreation.organizationInviteDraft.email.trim() ||
          organizationCreation.organizationInvites.length > 0,
      ),
    [organizationCreation.organizationForm, organizationCreation.organizationInviteDraft.email, organizationCreation.organizationInvites.length],
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

  const performOrganizationCancel = useCallback(() => {
    organizationCreation.setOrganizationSheetOpen(false);
    organizationCreation.resetOrganizationForm();
  }, [organizationCreation]);

  const handleOrganizationCancel = useCallback(() => {
    if (isOrganizationDirty) {
      setOrganizationDiscardDialogOpen(true);
      return;
    }
    performOrganizationCancel();
  }, [isOrganizationDirty, performOrganizationCancel]);

  useWindowEventBridge(PROJECTS_EVENTS.openNewProject, () => {
    setOpen(true);
  }, { custom: false });

  const loadOrganizations = useCallback(async () => {
    if (hasLoadedOrganizations || isLoadingOrganizations) return;

    setLoadingOrganizations(true);
    try {
      const response = await client.requestRaw("/api/projects/organizations", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Não foi possível carregar organizações.";
        throw new Error(message);
      }

      const nextOrganizations = Array.isArray(payload?.data?.organizations)
        ? payload.data.organizations.flatMap((organization: unknown): OrganizationOption[] => {
          if (!organization || typeof organization !== "object") return [];
          const record = organization as Record<string, unknown>;
          const id = typeof record.id === "string" ? record.id : "";
          const name = typeof record.name === "string" ? record.name : "";
          return id && name ? [{ id, name }] : [];
        })
        : [];

      setOrganizationOptions(nextOrganizations);
      if (!projectForm.organizationId && nextOrganizations[0]?.id) {
        projectForm.setOrganizationId(nextOrganizations[0].id);
      }
      setHasLoadedOrganizations(true);
    } catch (error) {
      setHasLoadedOrganizations(true);
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar organizações.");
    } finally {
      setLoadingOrganizations(false);
    }
  }, [hasLoadedOrganizations, isLoadingOrganizations, projectForm]);

  useEffect(() => {
    if (!open) return;
    void loadOrganizations();
  }, [loadOrganizations, open]);

  useEffect(() => {
    if (open) return;
    setOrganizationSheetOpen(false);
    resetOrganizationForm();
  }, [open, resetOrganizationForm, setOrganizationSheetOpen]);

  const addOrganizationInvite = () => {
    const email = organizationCreation.organizationInviteDraft.email.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email de convite inválido.");
      return;
    }

    organizationCreation.setOrganizationInvites((current) => {
      if (current.some((invite) => invite.email === email)) {
        return current;
      }
      return [...current, { email, role: organizationCreation.organizationInviteDraft.role }];
    });
    organizationCreation.setOrganizationInviteDraft({ email: "", role: "member" });
  };

  const removeOrganizationInvite = (email: string) => {
    organizationCreation.setOrganizationInvites((current) => current.filter((invite) => invite.email !== email));
  };

  const handleCreateOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organizationCreation.hasOrganizationName || isCreatingOrganization) return;

    setIsCreatingOrganization(true);
    try {
      const response = await client.requestRaw("/api/projects/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...organizationCreation.organizationForm,
          invitations: organizationCreation.organizationInvites,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const errorMessage = typeof payload?.error === "string" ? payload.error : "Não foi possível criar a organização.";
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
        throw new Error("Resposta inválida ao criar organização.");
      }

      const nextOrganizations = [...organizationOptions.filter((organization) => organization.id !== created.id), created]
        .toSorted((a, b) => a.name.localeCompare(b.name, "pt-PT"));
      setOrganizationOptions(nextOrganizations);
      projectForm.setOrganizationId(created.id);
      projectForm.setCodeTouched(false);
      organizationCreation.setOrganizationSheetOpen(false);
      organizationCreation.resetOrganizationForm();
      const pendingCount = inviteSummary?.pendingInvitations ?? 0;
      const directCount = (inviteSummary?.directAssignments ?? 0) + (inviteSummary?.updatedExistingMembers ?? 0);
      if (organizationCreation.organizationInvites.length > 0) {
        const failedEmailCount = inviteSummary?.failedEmailDeliveries ?? 0;
        toast.success(`Organização criada. ${pendingCount} convite(s) pendente(s), ${directCount} membro(s) aplicado(s) diretamente.`);
        if (failedEmailCount > 0) {
          toast.error(`${failedEmailCount} convite(s) foram criados, mas o email não foi enviado. Verifique a configuração do Resend.`);
        }
      } else {
        toast.success("Organização criada com sucesso.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar organização.");
    } finally {
      setIsCreatingOrganization(false);
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
        targetDate: projectForm.targetDate || undefined,
        cancellationReason: projectForm.cancellationReason.trim() || undefined,
        summary: projectForm.summary.trim() || undefined,
      });

      toast.success("Projeto criado. Podes completar a configuração agora ou mais tarde.");
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
      toast.error(error instanceof Error ? error.message : "Erro interno ao criar projeto.");
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
          `Existem vários gestores de projeto atribuídos. Escolhe qual deve ficar como responsável:\n${optionsText}`,
          "1",
        );

        if (selectedRaw === null) {
          setup.setSavingSetup(false);
          return;
        }

        const selectedIndex = Number.parseInt(selectedRaw, 10) - 1;
        if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex >= ownerCandidates.length) {
          throw new Error("Seleção inválida. Guarda novamente e escolhe um número da lista.");
        }

        const selectedOwnerProfileId = ownerCandidates[selectedIndex]?.profileId;
        if (!selectedOwnerProfileId) {
          throw new Error("Não foi possível validar o responsável selecionado.");
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
        const message = typeof projectPayload?.error === "string" ? projectPayload.error : "Erro ao guardar detalhes do projeto.";
        throw new Error(message);
      }

      const membersPayloadResponse = await membersResponse.json();
      if (!membersResponse.ok) {
        const message =
          typeof membersPayloadResponse?.error === "string"
            ? membersPayloadResponse.error
            : "Erro ao guardar equipa do projeto.";
        throw new Error(message);
      }

      toast.success("Configuração do projeto guardada.");
      setup.closeSetupSheet();
      dispatchProjectsEvent(PROJECTS_EVENTS.refresh);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar a configuração avançada.");
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
            eyebrow="A criar"
            title={<>Novo projeto</>}
            description={<>Define o projeto inicial para a organização e entra no fluxo de execução.</>}
          />

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-0">
            <div className={`${sheetBodyClassName} space-y-4`}>
              <FormSection title="Projeto">
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel className={sheetFieldLabelClassName}>Organização</FieldLabel>
                  <FieldContent>
                    <div className="mt-1.5 flex items-center gap-2">
                      <select
                        id="project-organization"
                        className={cn(sheetEditControlClassName, "text-foreground outline-none")}
                        value={projectForm.organizationId}
                        onChange={(event) => projectForm.setOrganizationId(event.target.value)}
                        required
                        disabled={!hasOrganizations || isLoadingOrganizations}
                      >
                        {hasOrganizations ? (
                          organizationOptions.map((organization) => (
                            <option key={organization.id} value={organization.id}>
                              {organization.name}
                            </option>
                          ))
                        ) : (
                          <option value="">Sem organizações disponíveis</option>
                        )}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0 rounded-lg px-2 text-[11px]"
                        onClick={() => organizationCreation.setOrganizationSheetOpen(true)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Nova
                      </Button>
                    </div>
                    {isLoadingOrganizations ? (
                      <p className="mt-1 text-[10px] text-foreground/55">A carregar organizações...</p>
                    ) : !hasOrganizations ? (
                      <p className="mt-1 text-[10px] text-foreground/55">Cria uma organização para continuar.</p>
                    ) : null}
                  </FieldContent>
                </Field>
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel className={sheetFieldLabelClassName}>Nome do projeto</FieldLabel>
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
                  <FieldLabel className={sheetFieldLabelClassName}>Código (opcional)</FieldLabel>
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
                    <p className="mt-0.5 text-[10px] text-foreground/55">Gerado automaticamente, mas podes ajustar.</p>
                  </FieldContent>
                </Field>
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel className={sheetFieldLabelClassName}>Resumo</FieldLabel>
                  <FieldContent>
                    <textarea
                      id="project-summary"
                      rows={3}
                      className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)}
                      value={projectForm.summary}
                      onChange={(event) => projectForm.setSummary(event.target.value)}
                      placeholder="Objetivo, entregáveis e contexto do projeto..."
                    />
                  </FieldContent>
                </Field>
              </FormSection>

              <FormSection title="Planeamento">
                <SelectField
                  id="project-status"
                  label="Estado"
                  value={projectForm.status}
                  onChange={(nextStatus) => {
                    projectForm.setStatus(nextStatus);
                    if (nextStatus !== "canceled") projectForm.setCancellationReason("");
                  }}
                >
                  <option value="planned">Planeamento</option>
                  <option value="active">Ativo</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="completed">Concluído</option>
                  <option value="canceled">Cancelado</option>
                </SelectField>
                <DateField
                  id="project-target-date"
                  label="Data alvo"
                  value={projectForm.targetDate}
                  onChange={projectForm.setTargetDate}
                />
                {projectForm.status === "canceled" ? (
                  <Field className="gap-1.5 px-4 py-2">
                    <FieldLabel className={sheetFieldLabelClassName}>Motivo cancelamento</FieldLabel>
                    <FieldContent>
                      <textarea
                        id="project-cancellation-reason"
                        rows={3}
                        className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)}
                        value={projectForm.cancellationReason}
                        onChange={(event) => projectForm.setCancellationReason(event.target.value)}
                        placeholder="Porque é que o projeto foi cancelado?"
                      />
                    </FieldContent>
                  </Field>
                ) : null}
              </FormSection>
            </div>

            <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
              <Button type="submit" className="flex-1" disabled={!hasOrganizations || !projectForm.isFormValid || isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? "A criar..." : "Criar projeto"}
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={handleProjectCancel} disabled={isSubmitting}>
                Cancelar
              </Button>
            </SheetFooter>
          </form>

          <Sheet
            open={organizationCreation.isOrganizationSheetOpen}
            onOpenChange={(next) => { if (next) organizationCreation.setOrganizationSheetOpen(true); else handleOrganizationCancel(); }}
          >
            <SheetContent className={sheetShellClassName}>
              <form onSubmit={handleCreateOrganization} className="flex min-h-0 flex-1 flex-col gap-0">
                <AppSheetHeader
                  icon={Building2}
                  editing
                  eyebrow="A criar"
                  title={<>Nova organização</>}
                  description={<>Ficha de empresa para consultorias</>}
                />

                <div className={`${sheetBodyClassName} space-y-4`}>
                  <FormSection title="Identificação">
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel className={sheetFieldLabelClassName}>Nome</FieldLabel>
                      <FieldContent>
                        <Input
                          value={organizationCreation.organizationForm.name}
                          onChange={(event) => organizationCreation.setOrganizationForm((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder="Empresa Verde, Lda."
                          className={cn(sheetEditControlClassName, "mt-1.5")}
                        />
                      </FieldContent>
                    </Field>
                    <SelectField
                      label="Indústria"
                      value={organizationCreation.organizationForm.industry}
                      onChange={(value) => organizationCreation.setOrganizationForm((prev) => ({ ...prev, industry: value }))}
                    >
                      <option value="">Selecionar indústria</option>
                      {industryOptions.map((industry) => (
                        <option key={industry} value={industry}>
                          {industry}
                        </option>
                      ))}
                    </SelectField>
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel className={sheetFieldLabelClassName}>Website</FieldLabel>
                      <FieldContent>
                        <Input
                          value={organizationCreation.organizationForm.websiteUrl}
                          onChange={(event) => organizationCreation.setOrganizationForm((prev) => ({ ...prev, websiteUrl: event.target.value }))}
                          placeholder="https://empresa.pt"
                          className={cn(sheetEditControlClassName, "mt-1.5")}
                        />
                      </FieldContent>
                    </Field>
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel className={sheetFieldLabelClassName}>Identificador fiscal</FieldLabel>
                      <FieldContent>
                        <Input
                          value={organizationCreation.organizationForm.taxIdentifierValue}
                          onChange={(event) => organizationCreation.setOrganizationForm((prev) => ({ ...prev, taxIdentifierValue: event.target.value.replace(/\D/g, "") }))}
                          placeholder="123456789"
                          inputMode="numeric"
                          className={cn(sheetEditControlClassName, "mt-1.5")}
                        />
                      </FieldContent>
                    </Field>
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel className={sheetFieldLabelClassName}>Morada</FieldLabel>
                      <FieldContent>
                        <div className="mt-0.5 space-y-2">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-foreground/45">Linha 1</p>
                            <Input
                              value={organizationCreation.organizationForm.addressLine1}
                              onChange={(event) => organizationCreation.setOrganizationForm((prev) => ({ ...prev, addressLine1: event.target.value }))}
                              placeholder="Rua Exemplo, 120"
                              className={cn(sheetEditControlClassName, "mt-1.5")}
                            />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-foreground/45">Linha 2</p>
                            <Input
                              value={organizationCreation.organizationForm.addressLine2}
                              onChange={(event) => organizationCreation.setOrganizationForm((prev) => ({ ...prev, addressLine2: event.target.value }))}
                              placeholder="Andar, sala, referência"
                              className={cn(sheetEditControlClassName, "mt-1.5")}
                            />
                          </div>
                        </div>
                      </FieldContent>
                    </Field>
                    <div className="grid grid-cols-2 gap-px">
                      <Field className="gap-1.5 px-4 py-2">
                        <FieldLabel className={sheetFieldLabelClassName}>Código postal</FieldLabel>
                        <FieldContent>
                          <Input
                            value={organizationCreation.organizationForm.zipCode}
                            onChange={(event) => organizationCreation.setOrganizationForm((prev) => ({ ...prev, zipCode: event.target.value }))}
                            placeholder="1000-001"
                            className={cn(sheetEditControlClassName, "mt-1.5")}
                          />
                        </FieldContent>
                      </Field>
                      <Field className="border-l border-black/6 px-4 py-2 dark:border-white/8">
                        <FieldLabel className={sheetFieldLabelClassName}>País</FieldLabel>
                        <FieldContent>
                          <Input
                            value={organizationCreation.organizationForm.country}
                            onChange={(event) => organizationCreation.setOrganizationForm((prev) => ({ ...prev, country: event.target.value }))}
                            placeholder="Portugal"
                            className={cn(sheetEditControlClassName, "mt-1.5")}
                          />
                        </FieldContent>
                      </Field>
                    </div>
                  </FormSection>

                  <FormSection title="Perfil">
                    <div className="grid grid-cols-2 gap-px">
                      <SelectField
                        label="Dimensão"
                        value={organizationCreation.organizationForm.companySize}
                        onChange={(value) => organizationCreation.setOrganizationForm((prev) => ({ ...prev, companySize: value }))}
                      >
                        <option value="">—</option>
                        {companySizeOptions.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </SelectField>
                      <SelectField
                        label="Orçamento"
                        value={organizationCreation.organizationForm.budgetRange}
                        onChange={(value) => organizationCreation.setOrganizationForm((prev) => ({ ...prev, budgetRange: value }))}
                        className="border-l border-black/6 px-4 py-2 dark:border-white/8"
                      >
                        <option value="">—</option>
                        {budgetRangeOptions.map((range) => (
                          <option key={range} value={range}>
                            {range}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  </FormSection>

                  <SheetSection title="Membros" editing bodyClassName="space-y-3 px-4 py-3">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                        <Input
                          value={organizationCreation.organizationInviteDraft.email}
                          onChange={(event) => organizationCreation.setOrganizationInviteDraft((prev) => ({ ...prev, email: event.target.value }))}
                          placeholder="email@empresa.pt"
                          className="h-8"
                        />
                        <select
                          className="h-8 rounded-md border border-black/10 bg-background px-2 text-xs dark:border-white/12 dark:bg-white/[0.04]"
                          value={organizationCreation.organizationInviteDraft.role}
                          onChange={(event) => organizationCreation.setOrganizationInviteDraft((prev) => ({ ...prev, role: event.target.value === "admin" ? "admin" : "member" }))}
                        >
                          <option value="member">Membro</option>
                          <option value="admin">Admin</option>
                        </select>
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={addOrganizationInvite}>
                          <Plus className="mr-1 h-3 w-3" />
                          Adicionar
                        </Button>
                      </div>

                      {organizationCreation.organizationInvites.length === 0 ? (
                        <p className="text-xs text-foreground/55">Opcional: adiciona convites para enviar após criar a organização.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {organizationCreation.organizationInvites.map((invite) => (
                            <div
                              key={invite.email}
                              className="flex items-center justify-between rounded-lg border border-black/8 bg-background/60 px-2.5 py-1.5 text-xs dark:border-white/12 dark:bg-white/[0.03]"
                            >
                              <span className="truncate text-foreground">{invite.email}</span>
                              <div className="flex items-center gap-2">
                                <span className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-foreground/70 dark:border-white/15">
                                  {invite.role === "admin" ? "Admin" : "Membro"}
                                </span>
                                <button
                                  type="button"
                                  className="text-rose-600 transition-colors hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                                  onClick={() => removeOrganizationInvite(invite.email)}
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-foreground/55">
                        O contacto principal é sincronizado automaticamente a partir dos membros com papel Admin.
                      </p>
                  </SheetSection>
                </div>

                <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
                  <Button type="submit" className="flex-1" disabled={!organizationCreation.hasOrganizationName || isCreatingOrganization}>
                    <Save className="mr-2 h-4 w-4" />
                    {isCreatingOrganization ? "A criar..." : "Criar organização"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleOrganizationCancel}
                    disabled={isCreatingOrganization}
                  >
                    Cancelar
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </SheetContent>
      </Sheet>

      <Sheet open={setup.setupOpen} onOpenChange={(next) => { if (!next && !setup.savingSetup) setup.closeSetupSheet(); }}>
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader
            icon={Users2}
            editing
            eyebrow="A editar"
            title={<>Configurar equipa</>}
            description={<>{setup.setupState?.projectName ? `Projeto: ${setup.setupState.projectName}` : "Define a equipa do projeto."}</>}
          />

          {setup.loadingSetupData || !setup.setupState ? (
            <div className={`${sheetBodyClassName} flex items-center justify-center py-12`}>
              <p className="inline-flex items-center gap-2 text-sm text-foreground/70">
                <Loader2 className="size-4 animate-spin" />
                A preparar detalhes do projeto...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSaveSetup} className="flex min-h-0 flex-1 flex-col gap-0">
              <div className={`${sheetBodyClassName} space-y-4`}>
                <SheetSection title="Equipa do projeto" editing>
                  <FieldGroup className="gap-0 px-0 py-1">
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel className={sheetFieldLabelClassName}>Equipa neste projeto</FieldLabel>
                      <FieldContent>
                        <div className="mt-1">
                          <SearchField
                            size="sm"
                            value={setup.memberSearch}
                            onChange={setup.setMemberSearch}
                            onClear={() => setup.setMemberSearch("")}
                            placeholder="Pesquisar por nome"
                          />
                        </div>
                        <div className="mt-1 space-y-2">
                          {setup.memberOptions.length === 0 ? <p className="text-xs text-foreground/60">Sem utilizadores disponíveis para atribuição.</p> : null}
                          {setup.memberOptions.length > 0 && setup.filteredMemberOptions.length === 0 ? <p className="text-xs text-foreground/60">Sem resultados para essa pesquisa.</p> : null}
                          {setup.filteredMemberOptions.map((member) => {
                            const selectedRole = setup.setupState?.members[member.profileId];
                            return (
                              <div key={member.profileId} className="flex items-center gap-2 rounded-xl border border-black/8 bg-background/70 px-3 py-2 dark:border-white/10">
                                <input
                                  id={`member-${member.profileId}`}
                                  type="checkbox"
                                  className="size-4 accent-primary"
                                  checked={Boolean(selectedRole)}
                                  onChange={() => setup.toggleMember(member.profileId)}
                                />
                                <label htmlFor={`member-${member.profileId}`} className="min-w-0 flex-1 text-sm">
                                  <span className="block truncate font-semibold text-foreground">{member.label}</span>
                                  <span className="block truncate text-xs text-foreground/60">
                                    {member.email ?? "Sem email"} · {PROJECT_MEMBER_SCOPE_LABELS[member.organizationRole]}
                                  </span>
                                </label>
                                <select
                                  className="h-7 rounded-md border border-black/10 bg-background px-2 text-xs dark:border-white/10"
                                  value={selectedRole ?? "contributor"}
                                  onChange={(event) => setup.setMemberRole(member.profileId, event.target.value as ProjectMemberRole)}
                                >
                                  <option value="owner">{PROJECT_MEMBER_ROLE_LABELS_PT.owner}</option>
                                  <option value="contributor">{PROJECT_MEMBER_ROLE_LABELS_PT.contributor}</option>
                                  <option value="observer">{PROJECT_MEMBER_ROLE_LABELS_PT.observer}</option>
                                </select>
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
                  {setup.savingSetup ? "A guardar..." : "Guardar configuração"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={setup.closeSetupSheet}
                  disabled={setup.savingSetup}
                >
                  Concluir depois
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={isProjectDiscardDialogOpen} onOpenChange={setProjectDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              As alterações que fez ainda não foram guardadas. Se sair agora, perde-as.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar a editar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                setProjectDiscardDialogOpen(false);
                performProjectCancel();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isOrganizationDiscardDialogOpen} onOpenChange={setOrganizationDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              As alterações que fez ainda não foram guardadas. Se sair agora, perde-as.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar a editar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                setOrganizationDiscardDialogOpen(false);
                performOrganizationCancel();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
