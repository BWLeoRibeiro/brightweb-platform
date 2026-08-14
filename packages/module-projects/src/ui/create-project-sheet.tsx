"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FolderKanban,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Users2,
} from "lucide-react";
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
  Checkbox,
  Field,
  FieldContent,
  FieldLabel,
  Input,
  SearchField,
  Sheet,
  SheetContent,
  SheetFooter,
  StyledSelect,
} from "@brightweblabs/ui";
import { SheetSelect, useShellAction } from "@brightweblabs/app-shell";
import { OrganizationCreateSheet, type OrganizationCreateSheetInput } from "@brightweblabs/module-orgs/ui";
import type { ProjectMemberRole } from "../contracts";
import { useProjectsUiClient, useProjectsUiDictionary } from "./context";
import { sheetBodyClassName, sheetFooterClassName, sheetShellClassName } from "./constants";
import { PROJECTS_EVENTS, dispatchProjectsEvent } from "./events";
import { DateField, FormSection, SelectField } from "./project-create/shared-fields";
import { reconcileLoadedOrganizationOptions, upsertOrganizationOption } from "./project-create/organization-options";
import { useProjectFormState } from "./project-create/use-project-form-state";
import {
  CLIENT_ACCESS_MODE_COPY,
  clientAccessDraftToPayload,
  getClientAccessDraftError,
  ProjectClientAccessEditor,
  type ClientAccessDraft,
  type ClientAccessOrganizationOption,
} from "./project-client-access-editor";
import { parseProjectBoardApiError } from "./project-board-response-parser";
import { AppSheetHeader } from "./shared/app-sheet";
import { sheetAccentTextareaClassName, sheetEditControlClassName, sheetFieldLabelClassName } from "./shared/sheet-section";
import { cn } from "./utils";
import { projectAccessDictionary } from "./project-access-dictionary";

type OrganizationOption = { id: string; name: string };
type StaffOption = {
  profileId: string;
  label: string;
  email: string | null;
  globalRole: "staff" | "admin";
  isCurrentUser: boolean;
};
type SetupOptions = { staff: StaffOption[]; organizations: ClientAccessOrganizationOption[] };
type WizardStep = 1 | 2 | 3 | 4;

const STEP_COPY: Array<{ step: WizardStep; short: string; title: string }> = projectAccessDictionary.wizard.steps.map((copy, index) => ({ ...copy, step: (index + 1) as WizardStep }));

function emptyClientAccess(): ClientAccessDraft {
  return { mode: "hidden", organizations: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // RFC 4122 v4 fallback for older embedded browsers. The key is used for
  // request replay protection, not as a security credential.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function parseSetupOptions(value: unknown): SetupOptions | null {
  const candidate = isRecord(value) && isRecord(value.data) ? value.data : value;
  if (!isRecord(candidate) || !Array.isArray(candidate.staff) || !Array.isArray(candidate.organizations)) return null;
  const staff = candidate.staff.flatMap((item) => {
    if (!isRecord(item) || typeof item.profileId !== "string" || typeof item.label !== "string") return [];
    if (item.globalRole !== "staff" && item.globalRole !== "admin") return [];
    return [{
      profileId: item.profileId,
      label: item.label,
      email: typeof item.email === "string" ? item.email : null,
      globalRole: item.globalRole,
      isCurrentUser: item.isCurrentUser === true,
    } satisfies StaffOption];
  });
  const organizations = candidate.organizations.flatMap((item) => {
    if (!isRecord(item) || typeof item.organizationId !== "string" || typeof item.organizationName !== "string") return [];
    const eligibleClients = Array.isArray(item.eligibleClients)
      ? item.eligibleClients.flatMap((client) => {
        if (!isRecord(client) || typeof client.profileId !== "string" || typeof client.label !== "string") return [];
        return [{ profileId: client.profileId, label: client.label, email: typeof client.email === "string" ? client.email : null }];
      })
      : [];
    return [{
      organizationId: item.organizationId,
      organizationName: item.organizationName,
      selected: item.selectedForClientAccess === true || item.selected === true,
      eligibleClients,
      selectedProfileIds: Array.isArray(item.selectedProfileIds)
        ? item.selectedProfileIds.filter((profileId): profileId is string => typeof profileId === "string")
        : [],
    } satisfies ClientAccessOrganizationOption];
  });
  return { staff, organizations };
}

function WizardProgress({ step }: { step: WizardStep }) {
  return (
    <nav aria-label={projectAccessDictionary.wizard.progressLabel} className="border-b border-[color:var(--border)] px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-meta font-semibold text-foreground">{STEP_COPY[step - 1]?.title}</p>
        <p className="text-micro tabular-nums text-muted-foreground">{projectAccessDictionary.wizard.step(step)}</p>
      </div>
      <ol className="grid grid-cols-4 gap-1.5">
        {STEP_COPY.map((item) => {
          const complete = item.step < step;
          const current = item.step === step;
          return (
            <li key={item.step} aria-current={current ? "step" : undefined}>
              <div className={cn(
                "h-1.5 rounded-full transition-colors",
                complete || current ? "bg-[color:var(--primary)]" : "bg-[color:var(--muted)]",
              )} />
              <span className={cn(
                "mt-1.5 hidden text-micro sm:block",
                current ? "font-semibold text-foreground" : "text-muted-foreground",
              )}>{complete ? projectAccessDictionary.wizard.complete : item.short}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-[color:var(--border)] px-3.5 py-2.5 first:border-t-0">
      <dt className="text-meta text-muted-foreground">{label}</dt>
      <dd className="max-w-[65%] text-right text-meta font-semibold text-foreground">{children}</dd>
    </div>
  );
}

export function CreateProjectSheet({ organizations, initialOpen = false }: { organizations: OrganizationOption[]; initialOpen?: boolean }) {
  const client = useProjectsUiClient();
  const dictionary = useProjectsUiDictionary();
  const [open, setOpen] = useState(initialOpen);
  const [step, setStep] = useState<WizardStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizationSheetOpen, setOrganizationSheetOpen] = useState(false);
  const [organizationOptions, setOrganizationOptions] = useState<OrganizationOption[]>(organizations);
  const [organizationsLoadState, setOrganizationsLoadState] = useState<"idle" | "pending" | "fulfilled" | "rejected">(organizations.length > 0 ? "fulfilled" : "idle");
  const [additionalOrganizationIds, setAdditionalOrganizationIds] = useState<string[]>([]);
  const [organizationSearch, setOrganizationSearch] = useState("");
  const [setupOptions, setSetupOptions] = useState<SetupOptions | null>(null);
  const [setupLoadState, setSetupLoadState] = useState<"idle" | "pending" | "fulfilled" | "rejected">("idle");
  const [members, setMembers] = useState<Record<string, ProjectMemberRole>>({});
  const [memberSearch, setMemberSearch] = useState("");
  const [clientAccess, setClientAccess] = useState<ClientAccessDraft>(emptyClientAccess);
  const [clientSummary, setClientSummary] = useState("");
  const [clientScope, setClientScope] = useState("");
  const [clientContactProfileId, setClientContactProfileId] = useState("");
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const organizationsRequestRef = useRef<AbortController | null>(null);
  const setupRequestRef = useRef<AbortController | null>(null);
  const createdOrganizationRef = useRef<OrganizationOption | null>(null);
  const latestCreatedOrganizationRef = useRef<OrganizationOption | null>(null);
  const defaultOrganizationIdRef = useRef(organizations[0]?.id ?? "");
  const idempotencyKeyRef = useRef<string | null>(null);
  const projectForm = useProjectFormState(organizationOptions);

  const hasOrganizations = organizationOptions.length > 0;
  const isLoadingOrganizations = organizationsLoadState === "pending";
  const participatingOrganizationIds = useMemo(() => Array.from(new Set([
    projectForm.organizationId,
    ...additionalOrganizationIds,
  ].filter(Boolean))), [additionalOrganizationIds, projectForm.organizationId]);
  const participatingOrganizations = participatingOrganizationIds.flatMap((id) => {
    const organization = organizationOptions.find((option) => option.id === id);
    return organization ? [organization] : [];
  });
  const ownerEntry = Object.entries(members).find(([, role]) => role === "owner");
  const owner = setupOptions?.staff.find((option) => option.profileId === ownerEntry?.[0]) ?? null;
  const currentActor = setupOptions?.staff.find((option) => option.isCurrentUser) ?? null;
  const ownerLockedToCreator = currentActor?.globalRole === "staff";
  const memberCount = Object.keys(members).length;
  const accessError = getClientAccessDraftError(clientAccess);
  const selectedAccessOrganizations = clientAccess.organizations.filter((organization) => organization.selected);
  const responsibleContactOptions = useMemo(
    () => (setupOptions?.staff ?? [])
      .filter((person) => Boolean(members[person.profileId]))
      .toSorted((a, b) => a.label.localeCompare(b.label, "pt-PT")),
    [members, setupOptions?.staff],
  );
  const selectedClientNames = Array.from(new Set(selectedAccessOrganizations.flatMap((organization) => {
    const selectedProfileIds = new Set(organization.selectedProfileIds);
    return organization.eligibleClients
      .filter((clientOption) => selectedProfileIds.has(clientOption.profileId))
      .map((clientOption) => clientOption.label);
  })));

  const dirty = Boolean(
    projectForm.name.trim()
    || projectForm.summary.trim()
    || projectForm.startDate
    || projectForm.targetDate
    || projectForm.codeTouched
    || projectForm.status !== "planned"
    || additionalOrganizationIds.length
    || Object.keys(members).length
    || clientAccess.mode !== "hidden"
    || clientSummary.trim()
    || clientScope.trim()
    || clientContactProfileId,
  );

  const loadOrganizations = useCallback(async () => {
    if (organizationsLoadState !== "idle") return;
    organizationsRequestRef.current?.abort();
    const controller = new AbortController();
    organizationsRequestRef.current = controller;
    setOrganizationsLoadState("pending");
    try {
      const nextOrganizations = await client.listOrganizations({ signal: controller.signal });
      if (controller.signal.aborted) return;
      const latestCreated = latestCreatedOrganizationRef.current;
      setOrganizationOptions(reconcileLoadedOrganizationOptions(nextOrganizations, latestCreated));
      if (!defaultOrganizationIdRef.current && nextOrganizations[0]?.id) defaultOrganizationIdRef.current = nextOrganizations[0].id;
      if (!projectForm.organizationId && nextOrganizations[0]?.id) projectForm.setOrganizationId(nextOrganizations[0].id);
      setOrganizationsLoadState("fulfilled");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setOrganizationsLoadState("rejected");
      toast.error(error instanceof Error ? error.message : dictionary.projectCreate.loadOrganizationsError);
    }
  }, [client, dictionary.projectCreate.loadOrganizationsError, organizationsLoadState, projectForm]);

  const loadSetupOptions = useCallback(async () => {
    if (participatingOrganizationIds.length === 0) return;
    setupRequestRef.current?.abort();
    const controller = new AbortController();
    setupRequestRef.current = controller;
    setSetupLoadState("pending");
    try {
      const params = new URLSearchParams({ organizationIds: participatingOrganizationIds.join(",") });
      const response = await client.requestRaw(`/api/projects/setup-options?${params.toString()}`, { cache: "no-store", signal: controller.signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parseProjectBoardApiError(payload, projectAccessDictionary.wizard.setupLoadError));
      const parsed = parseSetupOptions(payload);
      if (!parsed) throw new Error(projectAccessDictionary.wizard.invalidSetupResponse);
      if (controller.signal.aborted) return;
      setSetupOptions(parsed);
      setMembers((current) => {
        const validProfileIds = new Set(parsed.staff.map((person) => person.profileId));
        const retained = Object.fromEntries(Object.entries(current).filter(([profileId]) => validProfileIds.has(profileId))) as Record<string, ProjectMemberRole>;
        const creator = parsed.staff.find((person) => person.isCurrentUser);
        if (creator?.globalRole === "staff") {
          for (const [profileId, role] of Object.entries(retained)) {
            if (profileId !== creator.profileId && role === "owner") retained[profileId] = "contributor";
          }
          return { ...retained, [creator.profileId]: "owner" };
        }
        if (Object.values(retained).includes("owner")) return retained;
        return creator ? { ...retained, [creator.profileId]: "owner" } : retained;
      });
      setClientAccess((current) => ({
        ...current,
        organizations: parsed.organizations.map((organization) => {
          const previous = current.organizations.find((item) => item.organizationId === organization.organizationId);
          return previous ? { ...organization, selected: previous.selected, selectedProfileIds: previous.selectedProfileIds } : { ...organization, selected: false };
        }),
      }));
      setSetupLoadState("fulfilled");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setSetupLoadState("rejected");
      toast.error(error instanceof Error ? error.message : projectAccessDictionary.wizard.setupLoadError);
    }
  }, [client, participatingOrganizationIds]);

  useEffect(() => () => {
    organizationsRequestRef.current?.abort();
    setupRequestRef.current?.abort();
  }, []);
  useEffect(() => {
    if (open) void loadOrganizations();
  }, [loadOrganizations, open]);

  useShellAction(PROJECTS_EVENTS.openNewProject, () => setOpen(true));

  const resetWizard = useCallback(() => {
    setStep(1);
    setAdditionalOrganizationIds([]);
    setOrganizationSearch("");
    setSetupOptions(null);
    setSetupLoadState("idle");
    setMembers({});
    setMemberSearch("");
    setClientAccess(emptyClientAccess());
    setClientSummary("");
    setClientScope("");
    setClientContactProfileId("");
    idempotencyKeyRef.current = null;
    projectForm.resetProjectForm(organizationOptions, defaultOrganizationIdRef.current);
  }, [organizationOptions, projectForm]);

  const performClose = useCallback(() => {
    setupRequestRef.current?.abort();
    setOrganizationSheetOpen(false);
    resetWizard();
    setOpen(false);
  }, [resetWizard]);

  const requestClose = () => {
    if (isSubmitting) return;
    if (dirty) setDiscardDialogOpen(true);
    else performClose();
  };

  const nextFromProject = async () => {
    if (!projectForm.isFormValid) return;
    if (projectForm.status === "canceled" && !projectForm.cancellationReason.trim()) {
      toast.error("Indica o motivo do cancelamento.");
      return;
    }
    setStep(2);
    await loadSetupOptions();
  };

  const goToStep = (next: WizardStep) => {
    if (next === 3 && !owner) {
      toast.error(projectAccessDictionary.wizard.chooseOwner);
      return;
    }
    if (next === 4 && accessError) {
      toast.error(accessError);
      return;
    }
    setStep(next);
  };

  const toggleMember = (profileId: string) => {
    if (ownerLockedToCreator && profileId === currentActor?.profileId) return;
    if (members[profileId] && clientContactProfileId === profileId) setClientContactProfileId("");
    setMembers((current) => {
      const next = { ...current };
      if (next[profileId]) delete next[profileId];
      else next[profileId] = "contributor";
      return next;
    });
  };

  const setMemberRole = (profileId: string, role: ProjectMemberRole) => {
    if (ownerLockedToCreator && (profileId === currentActor?.profileId || role === "owner")) return;
    setMembers((current) => {
      const next = { ...current, [profileId]: role };
      if (role === "owner") {
        for (const [otherProfileId, otherRole] of Object.entries(next)) {
          if (otherProfileId !== profileId && otherRole === "owner") next[otherProfileId] = "contributor";
        }
      }
      return next;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step !== 4 || isSubmitting || !projectForm.isFormValid || !owner || accessError) return;
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createIdempotencyKey();
    }
    setIsSubmitting(true);
    try {
      const response = await client.requestRaw("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          project: {
            organizationId: projectForm.organizationId,
            name: projectForm.name.trim(),
            code: projectForm.code.trim() || undefined,
            status: projectForm.status,
            startDate: projectForm.startDate || undefined,
            targetDate: projectForm.targetDate || undefined,
            cancellationReason: projectForm.cancellationReason.trim() || undefined,
            summary: projectForm.summary.trim() || undefined,
            clientSummary: clientSummary.trim() || undefined,
            clientScope: clientScope.trim() || undefined,
            clientContactProfileId: clientContactProfileId || undefined,
          },
          participatingOrganizationIds,
          members: Object.entries(members).map(([profileId, role]) => ({ profileId, role })),
          clientAccess: clientAccessDraftToPayload(clientAccess),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parseProjectBoardApiError(payload, dictionary.projectCreate.projectCreateFallbackError));
      if (!isRecord(payload) || !isRecord(payload.data) || typeof payload.data.id !== "string") throw new Error(projectAccessDictionary.wizard.invalidCreateResponse);
      toast.success(clientAccess.mode === "hidden" ? projectAccessDictionary.wizard.createdPrivate : projectAccessDictionary.wizard.createdShared);
      dispatchProjectsEvent(PROJECTS_EVENTS.refresh);
      performClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.projectCreate.projectCreateFallbackError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateOrganization = async (input: OrganizationCreateSheetInput) => {
    const response = await client.requestRaw("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(parseProjectBoardApiError(payload, dictionary.projectCreate.createOrganizationError));
    const created = payload?.data?.organization as OrganizationOption | undefined;
    if (!created?.id || !created?.name) throw new Error(dictionary.projectCreate.invalidOrganizationResponse);
    createdOrganizationRef.current = created;
    latestCreatedOrganizationRef.current = created;
    flushSync(() => {
      setOrganizationOptions((current) => upsertOrganizationOption(current, created));
      projectForm.setOrganizationId(created.id);
      projectForm.setCodeTouched(false);
    });
    toast.success(dictionary.projectCreate.organizationCreated);
  };

  const filteredAdditionalOrganizations = organizationOptions.filter((organization) => (
    organization.id !== projectForm.organizationId
    && (!organizationSearch.trim() || organization.name.toLocaleLowerCase("pt-PT").includes(organizationSearch.trim().toLocaleLowerCase("pt-PT")))
  ));
  const filteredStaff = (setupOptions?.staff ?? []).filter((person) => (
    !memberSearch.trim()
    || person.label.toLocaleLowerCase("pt-PT").includes(memberSearch.trim().toLocaleLowerCase("pt-PT"))
    || (person.email ?? "").toLocaleLowerCase("pt-PT").includes(memberSearch.trim().toLocaleLowerCase("pt-PT"))
  ));

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => next ? setOpen(true) : requestClose()}>
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader
            icon={step === 1 ? FolderKanban : step === 2 ? Users2 : step === 3 ? ShieldCheck : Check}
            editing
            eyebrow={projectAccessDictionary.wizard.eyebrow}
            title={<>{STEP_COPY[step - 1]?.title}</>}
            description={<>{projectAccessDictionary.wizard.descriptions[step - 1]}</>}
          />
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <WizardProgress step={step} />
            <div className={`${sheetBodyClassName} space-y-4`}>
              {step === 1 ? (
                <>
                  <FormSection title={projectAccessDictionary.wizard.involvedOrganizations}>
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel htmlFor="project-organization" className={sheetFieldLabelClassName}>{projectAccessDictionary.wizard.primaryOrganization}</FieldLabel>
                      <FieldContent>
                        <div className="mt-1.5 flex gap-2">
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
                          <Button type="button" variant="outline" size="icon" className="size-9 shrink-0 rounded-lg" aria-label={dictionary.projectCreate.newOrganization} onClick={() => setOrganizationSheetOpen(true)}>
                            <Plus className="size-4" />
                          </Button>
                        </div>
                        {organizationsLoadState === "rejected" ? <p role="alert" className="mt-1 text-micro text-semantic-danger-strong">{dictionary.projectCreate.loadOrganizationsError}</p> : null}
                      </FieldContent>
                    </Field>
                    {organizationOptions.length > 1 ? (
                      <div className="border-t border-[color:var(--border)] px-4 py-3">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-label font-semibold text-foreground">{projectAccessDictionary.wizard.otherOrganizations}</p>
                            <p className="mt-0.5 text-meta text-muted-foreground">{projectAccessDictionary.wizard.otherOrganizationsHint}</p>
                          </div>
                          <span className="text-meta tabular-nums text-muted-foreground">{additionalOrganizationIds.length}</span>
                        </div>
                        {organizationOptions.length > 6 ? (
                          <SearchField size="sm" className="mt-3" value={organizationSearch} onChange={setOrganizationSearch} onClear={() => setOrganizationSearch("")} placeholder={projectAccessDictionary.wizard.searchOrganizations} />
                        ) : null}
                        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                          {filteredAdditionalOrganizations.map((organization) => {
                            const selected = additionalOrganizationIds.includes(organization.id);
                            return (
                              <label key={organization.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-[color:var(--muted)]/45">
                                <Checkbox checked={selected} onChange={() => setAdditionalOrganizationIds((current) => selected ? current.filter((id) => id !== organization.id) : [...current, organization.id])} />
                                <Building2 className="size-4 text-muted-foreground" />
                                <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">{organization.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </FormSection>

                  <FormSection title={projectAccessDictionary.wizard.project}>
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel htmlFor="project-name" className={sheetFieldLabelClassName}>{projectAccessDictionary.wizard.projectName}</FieldLabel>
                      <FieldContent><Input id="project-name" required value={projectForm.name} onChange={(event) => projectForm.setName(event.target.value)} className={cn(sheetEditControlClassName, "mt-1.5")} /></FieldContent>
                    </Field>
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel htmlFor="project-code" className={sheetFieldLabelClassName}>{projectAccessDictionary.wizard.optionalCode}</FieldLabel>
                      <FieldContent>
                        <Input id="project-code" value={projectForm.code} onChange={(event) => { projectForm.setCode(event.target.value); projectForm.setCodeTouched(true); }} className={cn(sheetEditControlClassName, "mt-1.5")} />
                        <p className="mt-0.5 text-micro text-muted-foreground">{projectAccessDictionary.wizard.generatedCode}</p>
                      </FieldContent>
                    </Field>
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel htmlFor="project-summary" className={sheetFieldLabelClassName}>{projectAccessDictionary.wizard.internalSummary}</FieldLabel>
                      <FieldContent><textarea id="project-summary" rows={3} value={projectForm.summary} onChange={(event) => projectForm.setSummary(event.target.value)} className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)} placeholder={projectAccessDictionary.wizard.internalSummaryPlaceholder} /></FieldContent>
                    </Field>
                  </FormSection>

                  <FormSection title={projectAccessDictionary.wizard.planning}>
                    <SelectField id="project-status" label={projectAccessDictionary.wizard.status} value={projectForm.status} onChange={(status) => { projectForm.setStatus(status); if (status !== "canceled") projectForm.setCancellationReason(""); }}>
                      <option value="planned">{dictionary.badge.status.planned}</option><option value="active">{dictionary.badge.status.active}</option><option value="paused">{dictionary.badge.status.paused}</option><option value="blocked">{dictionary.badge.status.blocked}</option><option value="completed">{dictionary.badge.status.completed}</option><option value="canceled">{dictionary.badge.status.canceled}</option>
                    </SelectField>
                    {projectForm.status === "canceled" ? (
                      <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor="project-cancellation-reason" className={sheetFieldLabelClassName}>{projectAccessDictionary.wizard.cancellationReason}</FieldLabel><FieldContent><textarea id="project-cancellation-reason" rows={3} value={projectForm.cancellationReason} onChange={(event) => projectForm.setCancellationReason(event.target.value)} className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)} /></FieldContent></Field>
                    ) : null}
                    <div className="grid gap-0 sm:grid-cols-2">
                      <DateField id="project-start-date" label={projectAccessDictionary.wizard.startDate} value={projectForm.startDate} onChange={projectForm.setStartDate} />
                      <DateField id="project-target-date" label={projectAccessDictionary.wizard.targetDate} value={projectForm.targetDate} onChange={projectForm.setTargetDate} />
                    </div>
                    {!projectForm.isDateRangeValid ? <p role="alert" className="px-4 pb-2 text-meta text-semantic-danger-strong">{projectAccessDictionary.wizard.invalidDateRange}</p> : null}
                  </FormSection>
                </>
              ) : null}

              {step === 2 ? (
                <FormSection title={projectAccessDictionary.wizard.internalTeam}>
                  {setupLoadState === "pending" ? (
                    <div className="flex min-h-40 items-center justify-center px-4 py-8"><p className="inline-flex items-center gap-2 text-body text-muted-foreground"><Loader2 className="size-4 animate-spin" />{projectAccessDictionary.wizard.preparing}</p></div>
                  ) : setupLoadState === "rejected" ? (
                    <div className="px-4 py-8 text-center"><p className="text-body font-semibold text-foreground">{projectAccessDictionary.wizard.setupErrorTitle}</p><p className="mt-1 text-meta text-muted-foreground">{projectAccessDictionary.wizard.setupErrorHint}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadSetupOptions}><RotateCcw className="mr-1.5 size-3.5" />{projectAccessDictionary.wizard.retry}</Button></div>
                  ) : (
                    <div className="px-4 py-3">
                      <div className="mb-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/30 px-3.5 py-3">
                        <p className="text-body font-semibold text-foreground">{projectAccessDictionary.wizard.ownerTitle}</p>
                        <p className="mt-0.5 text-meta text-muted-foreground">{ownerLockedToCreator ? projectAccessDictionary.wizard.staffOwnerLocked : projectAccessDictionary.wizard.ownerHint}</p>
                      </div>
                      <SearchField size="sm" value={memberSearch} onChange={setMemberSearch} onClear={() => setMemberSearch("")} placeholder={projectAccessDictionary.wizard.searchStaff} />
                      <div className="mt-2 space-y-1.5">
                        {filteredStaff.length === 0 ? <p className="py-5 text-center text-meta text-muted-foreground">{projectAccessDictionary.wizard.noInternalPeople}</p> : filteredStaff.map((person) => {
                          const role = members[person.profileId];
                          return (
                            <div key={person.profileId} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", role ? "border-[color:var(--primary)]/25 bg-[color:var(--primary)]/[0.025]" : "border-[color:var(--border)]")}>
                              <Checkbox checked={Boolean(role)} disabled={ownerLockedToCreator && person.isCurrentUser} aria-label={projectAccessDictionary.wizard.teamMembershipFor(person.label)} onChange={() => toggleMember(person.profileId)} />
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--muted)] text-micro font-bold text-muted-foreground">{person.label.slice(0, 1).toUpperCase()}</span>
                              <div className="min-w-0 flex-1"><p className="truncate text-body font-semibold text-foreground">{person.label}{person.isCurrentUser ? ` · ${projectAccessDictionary.wizard.you}` : ""}</p><p className="truncate text-meta text-muted-foreground">{person.email ?? projectAccessDictionary.wizard.noEmail} · {person.globalRole === "admin" ? projectAccessDictionary.wizard.admin : projectAccessDictionary.wizard.staff}</p></div>
                              <StyledSelect aria-label={projectAccessDictionary.wizard.roleFor(person.label)} className="h-8 max-w-32 rounded-lg border border-[color:var(--border)] bg-background px-2 text-meta" value={role ?? "contributor"} disabled={!role || (ownerLockedToCreator && person.isCurrentUser)} onChange={(event) => setMemberRole(person.profileId, event.target.value as ProjectMemberRole)}>
                                <option value="owner" disabled={ownerLockedToCreator && !person.isCurrentUser}>{projectAccessDictionary.wizard.roleOwner}</option><option value="contributor">{projectAccessDictionary.wizard.roleContributor}</option><option value="observer">{projectAccessDictionary.wizard.roleObserver}</option>
                              </StyledSelect>
                            </div>
                          );
                        })}
                      </div>
                      {!owner ? <p role="alert" className="mt-3 text-meta font-semibold text-semantic-danger-strong">{projectAccessDictionary.wizard.ownerRequired}</p> : null}
                    </div>
                  )}
                </FormSection>
              ) : null}

              {step === 3 ? (
                <>
                  <FormSection title={projectAccessDictionary.wizard.externalAudience}>
                    <div className="px-4 py-3"><ProjectClientAccessEditor value={clientAccess} onChange={setClientAccess} /></div>
                  </FormSection>
                  <FormSection title={projectAccessDictionary.wizard.clientInformation}>
                    <div className="border-b border-[color:var(--border)] px-4 py-3"><p className="text-meta leading-relaxed text-muted-foreground">{projectAccessDictionary.wizard.clientInformationHint}</p></div>
                    <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor="project-client-summary" className={sheetFieldLabelClassName}>{projectAccessDictionary.wizard.clientSummary}</FieldLabel><FieldContent><textarea id="project-client-summary" rows={3} value={clientSummary} onChange={(event) => setClientSummary(event.target.value)} className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)} placeholder={projectAccessDictionary.wizard.clientSummaryPlaceholder} /></FieldContent></Field>
                    <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor="project-client-scope" className={sheetFieldLabelClassName}>{projectAccessDictionary.wizard.clientScope}</FieldLabel><FieldContent><textarea id="project-client-scope" rows={3} value={clientScope} onChange={(event) => setClientScope(event.target.value)} className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)} placeholder={projectAccessDictionary.wizard.clientScopePlaceholder} /></FieldContent></Field>
                    <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor="project-client-contact" className={sheetFieldLabelClassName}>{projectAccessDictionary.wizard.optionalContact}</FieldLabel><FieldContent><StyledSelect id="project-client-contact" value={clientContactProfileId} onChange={(event) => setClientContactProfileId(event.target.value)} className={cn(sheetEditControlClassName, "mt-1.5 block w-full")}><option value="">{projectAccessDictionary.wizard.noContact}</option>{responsibleContactOptions.map((person) => <option key={person.profileId} value={person.profileId}>{person.label}{person.email ? ` · ${person.email}` : ""}</option>)}</StyledSelect><p className="mt-1 text-micro text-muted-foreground">{projectAccessDictionary.wizard.contactHint}</p></FieldContent></Field>
                  </FormSection>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <div className={cn("rounded-2xl border p-4", clientAccess.mode === "hidden" ? "border-[color:var(--border)] bg-[color:var(--muted)]/25" : "border-emerald-500/30 bg-emerald-500/[0.055]")}>
                    <div className="flex items-start gap-3">
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", clientAccess.mode === "hidden" ? "bg-[color:var(--muted)] text-muted-foreground" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
                        {clientAccess.mode === "hidden" ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </span>
                      <div><p className="text-body font-semibold text-foreground">{clientAccess.mode === "hidden" ? projectAccessDictionary.wizard.privateReviewTitle : projectAccessDictionary.wizard.sharedReviewTitle}</p><p className="mt-0.5 text-meta leading-relaxed text-muted-foreground">{clientAccess.mode === "hidden" ? projectAccessDictionary.wizard.privateReviewHint : projectAccessDictionary.wizard.sharedReviewHint(CLIENT_ACCESS_MODE_COPY[clientAccess.mode].title)}</p></div>
                    </div>
                  </div>
                  <FormSection title={projectAccessDictionary.wizard.projectAndOrganizations}><dl><ReviewRow label={projectAccessDictionary.wizard.project}>{projectForm.name}</ReviewRow><ReviewRow label={projectAccessDictionary.wizard.status}>{dictionary.badge.status[projectForm.status as keyof typeof dictionary.badge.status] ?? projectForm.status}</ReviewRow><ReviewRow label={projectAccessDictionary.wizard.primary}>{participatingOrganizations.find((organization) => organization.id === projectForm.organizationId)?.name ?? "—"}</ReviewRow><ReviewRow label={projectAccessDictionary.wizard.involved}>{participatingOrganizations.length}</ReviewRow></dl></FormSection>
                  <FormSection title={projectAccessDictionary.wizard.peopleAndAccess}><dl><ReviewRow label={projectAccessDictionary.wizard.owner}>{owner?.label ?? projectAccessDictionary.wizard.undefined}</ReviewRow><ReviewRow label={projectAccessDictionary.wizard.internalTeam}>{projectAccessDictionary.wizard.people(memberCount)}</ReviewRow><ReviewRow label={projectAccessDictionary.wizard.access}>{CLIENT_ACCESS_MODE_COPY[clientAccess.mode].title}</ReviewRow>{clientAccess.mode !== "hidden" ? <ReviewRow label={projectAccessDictionary.wizard.accessOrganizations}>{selectedAccessOrganizations.map((organization) => organization.organizationName).join(" · ")}</ReviewRow> : null}{clientAccess.mode === "selected_clients" ? <ReviewRow label={projectAccessDictionary.wizard.selectedClients}>{selectedClientNames.join(" · ")}</ReviewRow> : null}</dl></FormSection>
                  {clientAccess.mode !== "hidden" && (!clientSummary.trim() || !clientScope.trim()) ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3.5 py-3"><p className="text-body font-semibold text-foreground">{projectAccessDictionary.wizard.incompleteTitle}</p><p className="mt-0.5 text-meta text-muted-foreground">{projectAccessDictionary.wizard.incompleteHint(!clientSummary.trim() && !clientScope.trim() ? projectAccessDictionary.wizard.missingBoth : !clientSummary.trim() ? projectAccessDictionary.wizard.missingSummary : projectAccessDictionary.wizard.missingScope)}</p></div>
                  ) : null}
                </>
              ) : null}
            </div>

            <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
              {step > 1 ? <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setStep((step - 1) as WizardStep)}><ChevronLeft className="mr-1.5 size-4" />{projectAccessDictionary.wizard.back}</Button> : <Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>{projectAccessDictionary.wizard.cancel}</Button>}
              {step === 1 ? <Button type="button" className="flex-1" disabled={!hasOrganizations || !projectForm.isFormValid} onClick={nextFromProject}>{projectAccessDictionary.wizard.continue}<ChevronRight className="ml-1.5 size-4" /></Button> : null}
              {step === 2 ? <Button type="button" className="flex-1" disabled={setupLoadState !== "fulfilled" || !owner} onClick={() => goToStep(3)}>{projectAccessDictionary.wizard.continue}<ChevronRight className="ml-1.5 size-4" /></Button> : null}
              {step === 3 ? <Button type="button" className="flex-1" disabled={Boolean(accessError)} onClick={() => goToStep(4)}>{projectAccessDictionary.wizard.review}<ChevronRight className="ml-1.5 size-4" /></Button> : null}
              {step === 4 ? <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}{isSubmitting ? projectAccessDictionary.wizard.creating : clientAccess.mode === "hidden" ? projectAccessDictionary.wizard.createPrivate : projectAccessDictionary.wizard.createShared}</Button> : null}
            </SheetFooter>
          </form>

          <OrganizationCreateSheet
            open={organizationSheetOpen}
            onOpenChange={(next) => {
              setOrganizationSheetOpen(next);
              if (next) return;
              const created = createdOrganizationRef.current;
              if (!created) return;
              createdOrganizationRef.current = null;
              flushSync(() => {
                setOrganizationOptions((current) => upsertOrganizationOption(current, created));
                projectForm.setOrganizationId(created.id);
              });
            }}
            onSubmit={handleCreateOrganization}
            dictionary={{ eyebrow: dictionary.create.creatingEyebrow, title: dictionary.projectCreate.newOrganization, description: dictionary.projectCreate.organizationDescription, identity: dictionary.projectCreate.identification, name: dictionary.forms.name, industry: dictionary.projectCreate.industry, selectIndustry: dictionary.projectCreate.selectIndustry, website: dictionary.projectCreate.website, taxIdentifier: dictionary.projectCreate.taxIdentifier, location: dictionary.projectCreate.address, address: dictionary.projectCreate.line1, addressLine2: dictionary.projectCreate.line2, addressLine2Placeholder: dictionary.projectCreate.line2Placeholder, zipCode: dictionary.projectCreate.zipCode, country: dictionary.projectCreate.country, profile: dictionary.projectCreate.profile, companySize: dictionary.projectCreate.companySize, budgetRange: dictionary.projectCreate.budget, members: dictionary.projectCreate.members, member: dictionary.people.member, admin: dictionary.projectCreate.admin, add: dictionary.projectCreate.add, remove: dictionary.projectCreate.remove, optionalInvites: dictionary.projectCreate.optionalInvites, inviteHint: dictionary.projectCreate.primaryContactHint, invalidEmail: dictionary.projectCreate.invalidInviteEmail, create: dictionary.projectCreate.createOrganization, creating: dictionary.create.creating, cancel: dictionary.actions.cancel, createError: dictionary.projectCreate.organizationCreateFallbackError }}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{projectAccessDictionary.wizard.discardTitle}</AlertDialogTitle><AlertDialogDescription>{projectAccessDictionary.wizard.discardDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{projectAccessDictionary.wizard.keepEditing}</AlertDialogCancel><AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => { setDiscardDialogOpen(false); performClose(); }}>{projectAccessDictionary.wizard.discard}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}
