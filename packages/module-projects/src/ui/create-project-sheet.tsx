"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FolderKanban,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  UserPlus,
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
  Field,
  FieldContent,
  FieldLabel,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchField,
  Sheet,
  SheetContent,
  SheetFooter,
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
import { AppSheetHeader, SheetSection } from "./shared/app-sheet";
import { sheetAccentTextareaClassName, sheetEditControlClassName, sheetFieldLabelClassName } from "./shared/sheet-section";
import { cn } from "./utils";
import { projectAccessDictionary } from "./project-access-dictionary";
import {
  AddResultRow,
  applyProjectTeamMemberRoles,
  filterAvailableProjectMembers,
  TeamMemberRow,
  type ProjectMemberOption,
} from "./project-team-members";

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
type TeamView = "allocated" | "add";

const MAX_ADD_RESULTS = 25;

const STEP_COPY: Array<{ step: WizardStep; short: string; title: string }> = projectAccessDictionary.wizard.steps.map((copy, index) => ({ ...copy, step: (index + 1) as WizardStep }));

type OrganizationPickerProps = {
  id: string;
  value: string;
  options: OrganizationOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

function OrganizationPicker({
  id,
  value,
  options,
  onValueChange,
  disabled,
  placeholder = projectAccessDictionary.wizard.chooseOrganization,
}: OrganizationPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((organization) => organization.id === value) ?? null;
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-PT");
  const visibleOptions = options.filter((organization) => (
    !normalizedSearch || organization.name.toLocaleLowerCase("pt-PT").includes(normalizedSearch)
  ));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={projectAccessDictionary.wizard.primaryOrganization}
          disabled={disabled}
          className={cn(
            sheetEditControlClassName,
            "min-w-0 max-w-full justify-between px-2.5 font-normal hover:bg-[color:var(--card)]",
          )}
        >
          <span className={cn("truncate", selected ? "text-foreground" : "text-muted-foreground")}>
            {selected?.name ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
        <SearchField
          size="sm"
          autoFocus
          value={search}
          onChange={setSearch}
          onClear={() => setSearch("")}
          placeholder={projectAccessDictionary.wizard.searchOrganizations}
        />
        <div role="listbox" aria-label={projectAccessDictionary.wizard.primaryOrganization} className="mt-2 max-h-56 overflow-y-auto">
          {visibleOptions.map((organization) => {
            const isSelected = organization.id === value;
            return (
              <button
                key={organization.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn(
                  "flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-body transition-colors hover:bg-[color:var(--muted)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
                  isSelected && "bg-[color:var(--primary)]/[0.055] font-semibold",
                )}
                onClick={() => {
                  onValueChange(organization.id);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{organization.name}</span>
                {isSelected ? <Check className="size-4 shrink-0 text-[color:var(--primary)]" aria-hidden="true" /> : null}
              </button>
            );
          })}
          {visibleOptions.length === 0 ? (
            <p className="px-2.5 py-5 text-center text-meta text-muted-foreground">
              {projectAccessDictionary.wizard.noOrganizationResults}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function emptyClientAccess(): ClientAccessDraft {
  return { mode: "all_org_clients", organizations: [] };
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
  const organizationCount = candidate.organizations.length;
  const organizations = candidate.organizations.flatMap((item) => {
    if (!isRecord(item) || typeof item.organizationId !== "string" || typeof item.organizationName !== "string") return [];
    const eligibleClients = Array.isArray(item.eligibleClients)
      ? item.eligibleClients.flatMap((client) => {
        if (!isRecord(client) || typeof client.profileId !== "string" || typeof client.label !== "string") return [];
        return [{
          profileId: client.profileId,
          label: client.label,
          email: typeof client.email === "string" ? client.email : null,
          organizationRole: client.organizationRole === "admin" ? "admin" as const : client.organizationRole === "member" ? "member" as const : null,
        }];
      })
      : [];
    return [{
      organizationId: item.organizationId,
      organizationName: item.organizationName,
      isPrimary: item.isPrimary === true || organizationCount === 1,
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
    <nav
      aria-label={projectAccessDictionary.wizard.progressLabel}
      className="border-b border-[color:var(--border)] bg-[color:var(--muted)]/35 px-4 py-3"
    >
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
                complete || current ? "bg-[color:var(--primary)]" : "bg-background/80",
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
  const [setupOptions, setSetupOptions] = useState<SetupOptions | null>(null);
  const [setupLoadState, setSetupLoadState] = useState<"idle" | "pending" | "fulfilled" | "rejected">("idle");
  const [members, setMembers] = useState<Record<string, ProjectMemberRole>>({});
  const [teamView, setTeamView] = useState<TeamView>("allocated");
  const [pendingMemberRoles, setPendingMemberRoles] = useState<Record<string, ProjectMemberRole>>({});
  const [memberSearch, setMemberSearch] = useState("");
  const [clientAccess, setClientAccess] = useState<ClientAccessDraft>(emptyClientAccess);
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
  const participatingOrganizationIds = useMemo(
    () => projectForm.organizationId ? [projectForm.organizationId] : [],
    [projectForm.organizationId],
  );
  const primaryOrganization = organizationOptions.find((option) => option.id === projectForm.organizationId) ?? null;
  const ownerEntry = Object.entries(members).find(([, role]) => role === "owner");
  const owner = setupOptions?.staff.find((option) => option.profileId === ownerEntry?.[0]) ?? null;
  const memberCount = Object.keys(members).length;
  const staffMemberOptions = useMemo<ProjectMemberOption[]>(() => (
    (setupOptions?.staff ?? []).map((person) => ({
      profileId: person.profileId,
      label: person.label,
      email: person.email,
      organizationRole: person.globalRole,
      projectRole: members[person.profileId] ?? null,
    }))
  ), [members, setupOptions?.staff]);
  const staffByProfile = useMemo(
    () => new Map(staffMemberOptions.map((person) => [person.profileId, person])),
    [staffMemberOptions],
  );
  const teamMembers = useMemo(() => (
    Object.keys(members)
      .map((profileId) => staffByProfile.get(profileId))
      .filter((person): person is ProjectMemberOption => Boolean(person))
      .toSorted((a, b) => {
        const ownerOrder = Number(members[b.profileId] === "owner") - Number(members[a.profileId] === "owner");
        return ownerOrder || a.label.localeCompare(b.label, "pt-PT");
      })
  ), [members, staffByProfile]);
  const addResults = useMemo(
    () => filterAvailableProjectMembers(staffMemberOptions, members, memberSearch),
    [memberSearch, members, staffMemberOptions],
  );
  const pendingMemberCount = Object.keys(pendingMemberRoles).length;
  const accessError = getClientAccessDraftError(clientAccess);
  const selectedAccessOrganizations = clientAccess.organizations.filter((organization) => organization.selected);
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
    || Object.keys(members).length
    || clientAccess.mode !== "all_org_clients",
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
        return Object.fromEntries(
          Object.entries(current).filter(([profileId]) => validProfileIds.has(profileId)),
        ) as Record<string, ProjectMemberRole>;
      });
      setClientAccess((current) => ({
        ...current,
        organizations: parsed.organizations.map((organization) => {
          const previous = current.organizations.find((item) => item.organizationId === organization.organizationId);
          return previous
            ? { ...organization, selected: current.mode !== "hidden", selectedProfileIds: previous.selectedProfileIds }
            : { ...organization, selected: current.mode !== "hidden" };
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
    setSetupOptions(null);
    setSetupLoadState("idle");
    setMembers({});
    setTeamView("allocated");
    setPendingMemberRoles({});
    setMemberSearch("");
    setClientAccess(emptyClientAccess());
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
    if (next === 4 && accessError) {
      toast.error(accessError);
      return;
    }
    setStep(next);
  };

  const togglePendingMember = (profileId: string) => {
    setPendingMemberRoles((current) => {
      if (current[profileId]) {
        const next = { ...current };
        delete next[profileId];
        return next;
      }
      return { ...current, [profileId]: "contributor" };
    });
  };

  const setPendingMemberRole = (profileId: string, role: ProjectMemberRole) => {
    setPendingMemberRoles((current) => {
      if (!current[profileId]) return current;
      const next = { ...current, [profileId]: role };
      if (role === "owner") {
        for (const [otherProfileId, otherRole] of Object.entries(next)) {
          if (otherProfileId !== profileId && otherRole === "owner") next[otherProfileId] = "contributor";
        }
      }
      return next;
    });
  };

  const confirmPendingMembers = () => {
    setMembers((current) => applyProjectTeamMemberRoles(current, pendingMemberRoles));
    setPendingMemberRoles({});
    setMemberSearch("");
    setTeamView("allocated");
  };

  const returnToAllocatedTeam = () => {
    setPendingMemberRoles({});
    setMemberSearch("");
    setTeamView("allocated");
  };

  const removeMember = (profileId: string) => {
    setMembers((current) => {
      const next = { ...current };
      delete next[profileId];
      return next;
    });
  };

  const setMemberRole = (profileId: string, role: ProjectMemberRole) => {
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
    if (step !== 4 || isSubmitting || !projectForm.isFormValid || accessError) return;
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
            clientContactProfileId: owner?.profileId,
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
                      <FieldLabel htmlFor="project-organization" className={sheetFieldLabelClassName}>
                        {projectAccessDictionary.wizard.primaryOrganization}
                      </FieldLabel>
                      <FieldContent className="min-w-0">
                        <div className="mt-1.5 grid min-w-0 grid-cols-[minmax(0,1fr)_2.25rem] gap-2">
                          <OrganizationPicker
                            id="project-organization"
                            value={projectForm.organizationId}
                            onValueChange={projectForm.setOrganizationId}
                            disabled={!hasOrganizations || isLoadingOrganizations}
                            options={organizationsLoadState === "fulfilled" ? organizationOptions : []}
                            placeholder={isLoadingOrganizations
                              ? dictionary.projectCreate.loadingOrganizations
                              : organizationsLoadState === "rejected"
                                ? dictionary.projectCreate.loadOrganizationsError
                                : hasOrganizations
                                  ? projectAccessDictionary.wizard.chooseOrganization
                                  : dictionary.projectCreate.noOrganizations}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-9 shrink-0 rounded-lg"
                            aria-label={dictionary.projectCreate.newOrganization}
                            onClick={() => setOrganizationSheetOpen(true)}
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                        {organizationsLoadState === "rejected" ? (
                          <p role="alert" className="mt-1 text-micro text-semantic-danger-strong">
                            {dictionary.projectCreate.loadOrganizationsError}
                          </p>
                        ) : null}
                      </FieldContent>
                    </Field>
                  </FormSection>

                  <FormSection title={projectAccessDictionary.wizard.project}>
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel htmlFor="project-name" className={sheetFieldLabelClassName}>
                        {projectAccessDictionary.wizard.projectName}
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          id="project-name"
                          required
                          value={projectForm.name}
                          onChange={(event) => projectForm.setName(event.target.value)}
                          className={cn(sheetEditControlClassName, "mt-1.5")}
                        />
                      </FieldContent>
                    </Field>
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel htmlFor="project-code" className={sheetFieldLabelClassName}>
                        {projectAccessDictionary.wizard.optionalCode}
                      </FieldLabel>
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
                        <p className="mt-0.5 text-micro text-muted-foreground">{projectAccessDictionary.wizard.generatedCode}</p>
                      </FieldContent>
                    </Field>
                    <Field className="gap-1.5 px-4 py-2">
                      <FieldLabel htmlFor="project-summary" className={sheetFieldLabelClassName}>
                        {projectAccessDictionary.wizard.internalSummary}
                      </FieldLabel>
                      <FieldContent>
                        <textarea
                          id="project-summary"
                          rows={3}
                          value={projectForm.summary}
                          onChange={(event) => projectForm.setSummary(event.target.value)}
                          className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)}
                          placeholder={projectAccessDictionary.wizard.internalSummaryPlaceholder}
                        />
                      </FieldContent>
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
                setupLoadState === "pending" ? (
                  <SheetSection title={dictionary.team.inProject} editing>
                    <div className="flex min-h-40 items-center justify-center px-4 py-8"><p className="inline-flex items-center gap-2 text-body text-muted-foreground"><Loader2 className="size-4 animate-spin" />{projectAccessDictionary.wizard.preparing}</p></div>
                  </SheetSection>
                ) : setupLoadState === "rejected" ? (
                  <SheetSection title={dictionary.team.inProject} editing>
                    <div className="px-4 py-8 text-center"><p className="text-body font-semibold text-foreground">{projectAccessDictionary.wizard.setupErrorTitle}</p><p className="mt-1 text-meta text-muted-foreground">{projectAccessDictionary.wizard.setupErrorHint}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadSetupOptions}><RotateCcw className="mr-1.5 size-3.5" />{projectAccessDictionary.wizard.retry}</Button></div>
                  </SheetSection>
                ) : teamView === "allocated" ? (
                  <>
                    <div className="space-y-3">
                      <SheetSection
                        title={dictionary.team.inProject}
                        editing
                        aside={<span className="rounded-full bg-muted px-2 py-0.5 text-data text-meta font-semibold text-muted-foreground">{teamMembers.length}</span>}
                        bodyClassName="divide-y divide-[color:var(--border)]"
                      >
                        {teamMembers.length === 0 ? (
                          <p className="px-4 py-6 text-center text-meta text-muted-foreground">{dictionary.team.noneAllocated}</p>
                        ) : (
                          <div className="divide-y divide-[color:var(--border)]">
                            {teamMembers.map((person) => (
                              <TeamMemberRow
                                key={person.profileId}
                                member={person}
                                role={members[person.profileId]}
                                roleLabel={dictionary.team.memberRoleLabel(person.label)}
                                removeLabel={dictionary.team.remove}
                                removeTitle={dictionary.team.removeFromProject}
                                onRoleChange={(role) => setMemberRole(person.profileId, role)}
                                onRemove={() => removeMember(person.profileId)}
                              />
                            ))}
                          </div>
                        )}
                      </SheetSection>
                      {!owner ? <p className="text-meta text-muted-foreground">{projectAccessDictionary.wizard.ownerOptional}</p> : null}
                    </div>
                    <Button type="button" variant="outline" className="w-full justify-center" onClick={() => setTeamView("add")}>
                      <Plus className="mr-2 size-4" />
                      {dictionary.team.addMember}
                    </Button>
                  </>
                ) : (
                  <section className="space-y-3">
                    <SearchField size="sm" value={memberSearch} onChange={setMemberSearch} onClear={() => setMemberSearch("")} placeholder={dictionary.team.searchPlaceholder} />
                    {addResults.length === 0 ? (
                      <p className="text-meta text-foreground/55">{memberSearch.trim() ? dictionary.team.noResults(memberSearch.trim()) : dictionary.team.noneAvailable}</p>
                    ) : (
                      <div className="space-y-2">
                        {addResults.slice(0, MAX_ADD_RESULTS).map((person) => (
                          <AddResultRow
                            key={person.profileId}
                            member={person}
                            role={pendingMemberRoles[person.profileId] ?? null}
                            roleLabel={dictionary.team.memberRoleLabel(person.label)}
                            selectLabel={dictionary.team.selectMemberLabel(person.label)}
                            lockOwner={false}
                            onToggle={() => togglePendingMember(person.profileId)}
                            onRoleChange={(role) => setPendingMemberRole(person.profileId, role)}
                          />
                        ))}
                        {addResults.length > MAX_ADD_RESULTS ? <p className="text-meta text-foreground/55">{dictionary.team.resultLimit(MAX_ADD_RESULTS, addResults.length)}</p> : null}
                      </div>
                    )}
                  </section>
                )
              ) : null}

              {step === 3 ? (
                <FormSection title={projectAccessDictionary.wizard.clientAccess}>
                  <div className="px-4 py-3"><ProjectClientAccessEditor value={clientAccess} onChange={setClientAccess} showIntroduction={false} /></div>
                </FormSection>
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
                  <FormSection title={projectAccessDictionary.wizard.projectAndOrganization}><dl><ReviewRow label={projectAccessDictionary.wizard.project}>{projectForm.name}</ReviewRow><ReviewRow label={projectAccessDictionary.wizard.status}>{dictionary.badge.status[projectForm.status as keyof typeof dictionary.badge.status] ?? projectForm.status}</ReviewRow><ReviewRow label={projectAccessDictionary.wizard.organization}>{primaryOrganization?.name ?? "—"}</ReviewRow></dl></FormSection>
                  <FormSection title={projectAccessDictionary.wizard.peopleAndAccess}><dl><ReviewRow label={projectAccessDictionary.wizard.owner}>{owner?.label ?? projectAccessDictionary.wizard.undefined}</ReviewRow><ReviewRow label={projectAccessDictionary.wizard.internalTeam}>{projectAccessDictionary.wizard.people(memberCount)}</ReviewRow><ReviewRow label={projectAccessDictionary.wizard.access}>{CLIENT_ACCESS_MODE_COPY[clientAccess.mode].title}</ReviewRow>{clientAccess.mode !== "hidden" ? <ReviewRow label={projectAccessDictionary.wizard.accessOrganizations}>{selectedAccessOrganizations.map((organization) => organization.organizationName).join(" · ")}</ReviewRow> : null}{clientAccess.mode === "selected_clients" ? <ReviewRow label={projectAccessDictionary.wizard.selectedClients}>{selectedClientNames.join(" · ")}</ReviewRow> : null}</dl></FormSection>
                </>
              ) : null}
            </div>

            <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
              {step > 1 && !(step === 2 && teamView === "add") ? <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setStep((step - 1) as WizardStep)}><ChevronLeft className="mr-1.5 size-4" />{projectAccessDictionary.wizard.back}</Button> : null}
              {step === 1 ? <Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>{projectAccessDictionary.wizard.cancel}</Button> : null}
              {step === 1 ? <Button type="button" className="flex-1" disabled={!hasOrganizations || !projectForm.isFormValid} onClick={nextFromProject}>{projectAccessDictionary.wizard.continue}<ChevronRight className="ml-1.5 size-4" /></Button> : null}
              {step === 2 && teamView === "allocated" ? <Button type="button" className="flex-1" disabled={setupLoadState !== "fulfilled"} onClick={() => goToStep(3)}>{projectAccessDictionary.wizard.continue}<ChevronRight className="ml-1.5 size-4" /></Button> : null}
              {step === 2 && teamView === "add" ? <Button type="button" className="flex-1" disabled={pendingMemberCount === 0} onClick={confirmPendingMembers}><UserPlus className="mr-2 size-4" />{dictionary.team.addSelectedMembers(pendingMemberCount)}</Button> : null}
              {step === 2 && teamView === "add" ? <Button type="button" variant="outline" className="flex-1" onClick={returnToAllocatedTeam}><ArrowLeft className="mr-2 size-4" />{dictionary.team.backToTeam}</Button> : null}
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
