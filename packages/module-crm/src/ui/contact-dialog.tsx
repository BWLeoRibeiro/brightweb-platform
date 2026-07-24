"use client";

import { useEffect, useId, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { Pencil, Save, Trash2 } from "lucide-react";
import {
  AppSheetBody,
  AppSheetFooter,
  AppSheetHeader,
  SheetSection,
  sheetEditControlClassName,
  sheetShellClassName,
  sheetViewControlClassName,
} from "@brightweblabs/app-shell";
import { Button, Field, FieldContent, FieldGroup, FieldLabel, Input, PhoneInput, Sheet, SheetContent } from "@brightweblabs/ui";

import type { CrmContact, CrmOwnerOption } from "../data";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import type { CrmContactFormInput, CrmOrganizationOption, CrmStageConfig, CrmUiDictionary } from "./types";

type ContactMode = "create" | "view" | "edit";

function initialValue(contact?: CrmContact | null): CrmContactFormInput {
  return { firstName: contact?.first_name ?? "", lastName: contact?.last_name ?? "", email: contact?.email ?? "", phone: contact?.phone ?? "", source: contact?.source ?? "", organizationId: contact?.organization_id ?? "", ownerId: contact?.owner_id ?? "", status: (contact?.status as CrmContactFormInput["status"]) ?? "lead" };
}

export type CrmContactDialogProps = {
  open: boolean;
  contact?: CrmContact | null;
  organizations?: CrmOrganizationOption[];
  owners?: CrmOwnerOption[];
  dictionary?: CrmUiDictionary;
  stages?: CrmStageConfig[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CrmContactFormInput) => Promise<void> | void;
  onTimeline?: (contact: CrmContact) => void;
  onDelete?: (contact: CrmContact) => void;
};

export function CrmContactDialog({ open, contact, organizations = [], owners = [], dictionary = defaultCrmUiDictionary, stages, onOpenChange, onSubmit, onTimeline, onDelete }: CrmContactDialogProps) {
  const fieldId = useId();
  const [value, setValue] = useState(() => initialValue(contact));
  const [mode, setMode] = useState<ContactMode>(contact ? "view" : "create");
  const [saving, setSaving] = useState(false);
  const resolvedStages = resolveCrmStages(dictionary, stages);
  const activeStage = resolvedStages.find((stage) => stage.value === value.status) ?? resolvedStages[0];
  const controlClassName = mode === "view" ? sheetViewControlClassName : sheetEditControlClassName;
  const ownerLabel = owners.find((owner) => owner.id === value.ownerId)?.label ?? dictionary.contactDialog.placeholders.owner;

  useEffect(() => {
    if (!open) return;
    setValue(initialValue(contact));
    setMode(contact ? "view" : "create");
  }, [contact, open]);

  const createdLabel = useMemo(() => {
    if (!contact?.created_at) return null;
    const date = new Date(contact.created_at);
    return Number.isNaN(date.getTime()) ? contact.created_at : new Intl.DateTimeFormat(dictionary.locale, { day: "2-digit", month: "long", year: "numeric" }).format(date);
  }, [contact?.created_at, dictionary.locale]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "view") return;
    setSaving(true);
    try { await onSubmit(value); onOpenChange(false); } finally { setSaving(false); }
  };

  const name = [value.firstName, value.lastName].filter(Boolean).join(" ") || dictionary.contactDialog.noName;
  const initials = `${value.firstName?.[0] ?? ""}${value.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const tintStyle = activeStage ? ({ "--tint": `var(${activeStage.token})` } as CSSProperties) : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={sheetShellClassName}>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-0">
          <AppSheetHeader
            editing={mode !== "view"}
            eyebrow={mode === "view" ? dictionary.contactDialog.viewEyebrow : mode === "edit" ? dictionary.contactDialog.editEyebrow : dictionary.contactDialog.createEyebrow}
            leading={<div className="tint-soft flex size-12 shrink-0 items-center justify-center rounded-2xl text-base font-semibold tracking-tight shadow-sm" style={tintStyle}>{initials}</div>}
            title={<span className="flex min-w-0 items-center gap-2"><span className="truncate">{mode === "create" ? dictionary.contactDialog.createTitle : name}</span>{activeStage ? <span className="tint-soft inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={tintStyle}>{activeStage.label}</span> : null}</span>}
            description={mode === "create" ? dictionary.contactDialog.createDescription : createdLabel ? dictionary.contactDialog.createdOn(createdLabel) : dictionary.contactDialog.description}
          />

          <AppSheetBody>
            <SheetSection title={dictionary.contactDialog.information} editing={mode !== "view"}>
              <FieldGroup className={`gap-0 px-0 py-1 ${mode === "view" ? "divide-y divide-hairline" : ""}`}>
                <div className={`flex ${mode === "view" ? "divide-x divide-hairline" : "gap-3"}`}>
                  <div className="min-w-0 flex-1 px-4 py-2 sm:pr-5"><FieldLabel htmlFor={`${fieldId}-first-name`} className="text-[10px] uppercase tracking-wider text-foreground-muted-accessible">Nome próprio</FieldLabel><Input id={`${fieldId}-first-name`} name="firstName" autoComplete="given-name" value={value.firstName ?? ""} disabled={mode === "view"} onChange={(event) => setValue({ ...value, firstName: event.target.value })} placeholder={dictionary.contactDialog.placeholders.firstName} className={`${controlClassName} mt-1.5`} /></div>
                  <div className="min-w-0 flex-1 px-4 py-2 sm:pl-5"><FieldLabel htmlFor={`${fieldId}-last-name`} className="text-[10px] uppercase tracking-wider text-foreground-muted-accessible">Apelido</FieldLabel><Input id={`${fieldId}-last-name`} name="lastName" autoComplete="family-name" value={value.lastName ?? ""} disabled={mode === "view"} onChange={(event) => setValue({ ...value, lastName: event.target.value })} placeholder={dictionary.contactDialog.placeholders.lastName} className={`${controlClassName} mt-1.5`} /></div>
                </div>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-email`} className="text-[10px] uppercase tracking-wider text-foreground-muted-accessible">{dictionary.contactDialog.fields.email}</FieldLabel><FieldContent><Input id={`${fieldId}-email`} name="email" autoComplete="email" type="email" value={value.email ?? ""} disabled={mode === "view"} onChange={(event) => setValue({ ...value, email: event.target.value })} placeholder={dictionary.contactDialog.placeholders.email} className={controlClassName} /></FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-phone`} className="text-[10px] uppercase tracking-wider text-foreground-muted-accessible">{dictionary.contactDialog.fields.phone}</FieldLabel><FieldContent><PhoneInput id={`${fieldId}-phone`} name="phone" autoComplete="tel" value={value.phone ?? ""} disabled={mode === "view"} onChange={(phone) => setValue({ ...value, phone })} className={mode === "view" ? sheetViewControlClassName : "h-9 rounded-lg border border-[color:var(--sheet-edit-control-border)] bg-[color:var(--card)] px-2.5"} /></FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-organization`} className="text-[10px] uppercase tracking-wider text-foreground-muted-accessible">{dictionary.contactDialog.fields.organization}</FieldLabel><FieldContent><select id={`${fieldId}-organization`} name="organizationId" value={value.organizationId ?? ""} disabled={mode === "view"} onChange={(event) => setValue({ ...value, organizationId: event.target.value })} className={`${controlClassName} text-foreground outline-none disabled:pointer-events-none`}><option value="">{dictionary.contactDialog.placeholders.organization}</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name ?? organization.id}</option>)}</select></FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel id={`${fieldId}-owner-label`} htmlFor={`${fieldId}-owner`} className="text-[10px] uppercase tracking-wider text-foreground-muted-accessible">{dictionary.contactDialog.fields.owner}</FieldLabel><FieldContent>{mode === "view" ? <p id={`${fieldId}-owner`} aria-labelledby={`${fieldId}-owner-label`} className="text-sm text-foreground/75">{ownerLabel}</p> : <select id={`${fieldId}-owner`} name="ownerId" value={value.ownerId ?? ""} onChange={(event) => setValue({ ...value, ownerId: event.target.value })} className={`${sheetEditControlClassName} text-foreground outline-none`}><option value="">{dictionary.contactDialog.placeholders.owner}</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label} ({owner.role === "admin" ? "Admin" : "Staff"})</option>)}</select>}</FieldContent></Field>
              </FieldGroup>
            </SheetSection>

            <SheetSection title={dictionary.contactDialog.pipeline} editing={mode !== "view"} bodyClassName="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted-accessible">{dictionary.contactDialog.fields.status}</p>
              {mode === "view" ? <div className="mt-1.5">{activeStage ? <span className="tint-soft inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold" style={tintStyle}>{activeStage.label}</span> : null}</div> : <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{resolvedStages.map((stage) => <button key={stage.value} type="button" onClick={() => setValue({ ...value, status: stage.value })} className={`inline-flex shrink-0 items-center justify-center rounded-xl border px-2.5 py-2 text-[11px] font-semibold transition ${value.status === stage.value ? "tint-soft shadow-sm" : "border-hairline bg-background text-foreground/50"}`} style={{ "--tint": `var(${stage.token})` } as CSSProperties}>{stage.label}</button>)}</div>}
            </SheetSection>

            {mode === "edit" && contact && onDelete ? <Button type="button" variant="link" size="link" className="w-fit p-0 text-sm text-destructive" onClick={() => onDelete(contact)}><Trash2 className="mr-1.5 size-3.5" />{dictionary.contactDialog.delete}</Button> : null}
            {mode === "view" && contact && onTimeline ? <Button type="button" variant="link" size="link" className="w-fit p-0 text-sm" onClick={() => onTimeline(contact)}>{dictionary.contactDialog.timeline}</Button> : null}
          </AppSheetBody>

          <AppSheetFooter className={mode === "view" ? undefined : "flex-row"}>
            {mode === "view" ? <Button type="button" className="w-full" onClick={() => setMode("edit")}><Pencil className="mr-2 size-4" />{dictionary.contactDialog.edit}</Button> : <><Button type="submit" className="flex-1" disabled={saving}><Save className="mr-2 size-4" />{saving ? dictionary.contactDialog.saving : dictionary.contactDialog.save}</Button><Button type="button" variant="outline" className="flex-1" onClick={() => contact ? (setValue(initialValue(contact)), setMode("view")) : onOpenChange(false)}>{dictionary.contactDialog.cancel}</Button></>}
          </AppSheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
