"use client";

import { useId, useState } from "react";
import { BriefcaseBusiness, Users } from "lucide-react";
import { Checkbox, StyledSelect } from "@brightweblabs/ui";
import type { ClientTaskWorkbench, StaffClientTask } from "../client-tasks-contracts";
import { clientTasksDictionary as copy } from "./client-tasks/dictionary";
import { sheetFieldLabelClassName } from "./shared/sheet-section";
import { cn } from "./utils";

export type TaskRecipient = "internal" | "client";

export function TaskRecipientSelector({ value, onChange, locked = false, canCreateMemberTasks = false }: {
  value: TaskRecipient;
  onChange?: (value: TaskRecipient) => void;
  locked?: boolean;
  canCreateMemberTasks?: boolean;
}) {
  const id = useId();
  return <fieldset className="space-y-2">
    <legend className={sheetFieldLabelClassName}>{copy.taskFor}</legend>
    <div className="grid grid-cols-2 gap-2">
      {([{ value: "internal", label: copy.internalTeam, Icon: BriefcaseBusiness }, { value: "client", label: copy.organizationMembers, Icon: Users }] as const).map(({ value: kind, label, Icon }) => <label key={kind} className={cn("flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-meta font-semibold", value === kind ? "border-primary/35 bg-primary/5 text-foreground" : "border-border bg-background text-muted-foreground", !locked && kind === "client" && !canCreateMemberTasks && "opacity-50")}>
        <input type="radio" name={`${id}-recipient`} value={kind} checked={value === kind} disabled={locked || (kind === "client" && !canCreateMemberTasks)} onChange={() => onChange?.(kind)} className="size-3.5 accent-primary" />
        <Icon className="hidden size-4 shrink-0 sm:block" />{label}
      </label>)}
    </div>
    <p className="text-meta text-muted-foreground">{locked ? copy.recipientLocked : value === "client" ? copy.memberRecipientHint : copy.internalRecipientHint}</p>
  </fieldset>;
}

export function useMemberTaskRecipients(task: StaffClientTask | null, organizations: ClientTaskWorkbench["organizations"]) {
  const [organization, setOrganization] = useState<string | null>(task?.organizationId ?? organizations[0]?.id ?? null);
  const [audienceMode, setAudienceMode] = useState<"all_eligible" | "selected">(task?.audienceMode ?? "all_eligible");
  const [selected, setSelected] = useState(task?.selectedProfileIds ?? []);
  const [responsible, setResponsible] = useState(task?.responsibleProfileId ?? "");
  const organizationId = organization ?? organizations[0]?.id ?? "";
  const eligibleClients = organizations.find((item) => item.id === organizationId)?.eligibleClients ?? [];
  const eligibleIds = new Set(eligibleClients.map((member) => member.profileId));
  const validSelection = selected.filter((profileId) => eligibleIds.has(profileId));
  const responsibleOptions = audienceMode === "selected" ? eligibleClients.filter((member) => validSelection.includes(member.profileId)) : eligibleClients;
  const responsibleProfileId = responsibleOptions.some((member) => member.profileId === responsible) ? responsible : "";
  const valid = Boolean(organizationId && organizations.some((item) => item.id === organizationId) && (audienceMode !== "selected" || validSelection.length));
  return {
    organizationId, audienceMode, validSelection, eligibleClients, responsibleOptions, responsibleProfileId, valid,
    changeOrganization: (value: string) => { setOrganization(value); setSelected([]); setResponsible(""); },
    changeAudience: (value: "all_eligible" | "selected") => { setAudienceMode(value); setResponsible(""); },
    toggleMember: (profileId: string, checked: boolean) => setSelected((current) => checked ? [...new Set([...current, profileId])] : current.filter((id) => id !== profileId)),
    setResponsible,
    reset: () => { setOrganization(organizations[0]?.id ?? null); setAudienceMode("all_eligible"); setSelected([]); setResponsible(""); },
    input: { organizationId, audienceMode, selectedProfileIds: audienceMode === "selected" ? validSelection : [], responsibleProfileId: responsibleProfileId || null },
  };
}

type Recipients = ReturnType<typeof useMemberTaskRecipients>;

export function MemberTaskResponsibleField({ recipients, id }: { recipients: Recipients; id: string }) {
  return <div>
    <label className={sheetFieldLabelClassName} htmlFor={id}>{copy.unifiedResponsible}</label>
    <StyledSelect id={id} className="mt-1.5 w-full" value={recipients.responsibleProfileId} onChange={(event) => recipients.setResponsible(event.target.value)}>
      <option value="">{copy.noResponsible}</option>
      {recipients.responsibleOptions.map((member) => <option key={member.profileId} value={member.profileId}>{member.label}</option>)}
    </StyledSelect>
    <p className="mt-1 text-meta text-muted-foreground">{copy.memberAssigneeHint}</p>
  </div>;
}

export function MemberTaskAudienceFields({ recipients, organizations, id }: { recipients: Recipients; organizations: ClientTaskWorkbench["organizations"]; id: string }) {
  return <section className="space-y-4 rounded-xl border border-primary/15 bg-primary/[0.035] p-4" aria-label={copy.memberAccess}>
    <h3 className="text-label font-semibold">{copy.memberAccess}</h3>
    <div><label className={sheetFieldLabelClassName} htmlFor={`${id}-organization`}>{copy.organizationRecipient}</label><StyledSelect id={`${id}-organization`} className="mt-1.5 w-full" required value={recipients.organizationId} onChange={(event) => recipients.changeOrganization(event.target.value)}><option value="">{copy.selectOrganization}</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</StyledSelect></div>
    <div><label className={sheetFieldLabelClassName} htmlFor={`${id}-audience`}>{copy.audience}</label><StyledSelect id={`${id}-audience`} className="mt-1.5 w-full" value={recipients.audienceMode} onChange={(event) => recipients.changeAudience(event.target.value as "all_eligible" | "selected")}><option value="all_eligible">{copy.allEligibleOption}</option><option value="selected">{copy.selectedPeople}</option></StyledSelect><p className="mt-1 text-meta text-muted-foreground">{copy.audienceHint}</p></div>
    {recipients.audienceMode === "selected" ? <fieldset className="space-y-2 rounded-xl border border-border bg-background p-3"><legend className="px-1 text-label font-semibold">{copy.audiencePeople}</legend>{recipients.eligibleClients.length === 0 ? <p className="text-meta text-muted-foreground">{copy.noEligibleClients}</p> : recipients.eligibleClients.map((member) => <label key={member.profileId} className="flex min-h-11 items-center gap-3 text-body"><Checkbox checked={recipients.validSelection.includes(member.profileId)} onChange={(event) => recipients.toggleMember(member.profileId, event.target.checked)} />{member.label}</label>)}</fieldset> : null}
    <p className="text-meta text-muted-foreground">{copy.responsibleHint}</p>
  </section>;
}
