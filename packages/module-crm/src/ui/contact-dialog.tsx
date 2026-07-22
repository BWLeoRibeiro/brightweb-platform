"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  PhoneInput,
} from "@brightweblabs/ui";

import type { CrmContact, CrmOwnerOption } from "../data";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import type { CrmContactFormInput, CrmOrganizationOption, CrmStageConfig, CrmUiDictionary } from "./types";

function initialValue(contact?: CrmContact | null): CrmContactFormInput {
  return {
    firstName: contact?.first_name ?? "",
    lastName: contact?.last_name ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    source: contact?.source ?? "",
    organizationId: contact?.organization_id ?? "",
    ownerId: contact?.owner_id ?? "",
    status: (contact?.status as CrmContactFormInput["status"]) ?? "lead",
  };
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

export function CrmContactDialog({
  open,
  contact,
  organizations = [],
  owners = [],
  dictionary = defaultCrmUiDictionary,
  stages,
  onOpenChange,
  onSubmit,
  onTimeline,
  onDelete,
}: CrmContactDialogProps) {
  const [value, setValue] = useState(() => initialValue(contact));
  const [saving, setSaving] = useState(false);
  const resolvedStages = resolveCrmStages(dictionary, stages);

  useEffect(() => {
    if (open) setValue(initialValue(contact));
  }, [contact, open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(value);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <form onSubmit={submit}>
          <AlertDialogHeader>
            <AlertDialogTitle>{contact ? dictionary.contactDialog.editTitle : dictionary.contactDialog.createTitle}</AlertDialogTitle>
            <AlertDialogDescription>{dictionary.contactDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="crm-first-name">{dictionary.contactDialog.fields.firstName}</FieldLabel><Input id="crm-first-name" value={value.firstName ?? ""} onChange={(event) => setValue({ ...value, firstName: event.target.value })} placeholder={dictionary.contactDialog.placeholders.firstName} /></Field>
            <Field><FieldLabel htmlFor="crm-last-name">{dictionary.contactDialog.fields.lastName}</FieldLabel><Input id="crm-last-name" value={value.lastName ?? ""} onChange={(event) => setValue({ ...value, lastName: event.target.value })} placeholder={dictionary.contactDialog.placeholders.lastName} /></Field>
            <Field><FieldLabel htmlFor="crm-email">{dictionary.contactDialog.fields.email}</FieldLabel><Input id="crm-email" type="email" value={value.email ?? ""} onChange={(event) => setValue({ ...value, email: event.target.value })} placeholder={dictionary.contactDialog.placeholders.email} /></Field>
            <Field>
              <FieldLabel>{dictionary.contactDialog.fields.phone}</FieldLabel>
              <div className="h-11 rounded-xl border border-foreground/15 bg-foreground/5 px-3 py-2"><PhoneInput value={value.phone ?? ""} onChange={(phone) => setValue({ ...value, phone })} /></div>
            </Field>
            <Field><FieldLabel htmlFor="crm-source">{dictionary.contactDialog.fields.source}</FieldLabel><Input id="crm-source" value={value.source ?? ""} onChange={(event) => setValue({ ...value, source: event.target.value })} placeholder={dictionary.contactDialog.placeholders.source} /></Field>
            <Field>
              <FieldLabel htmlFor="crm-status">{dictionary.contactDialog.fields.status}</FieldLabel>
              <select id="crm-status" value={value.status} onChange={(event) => setValue({ ...value, status: event.target.value as CrmContactFormInput["status"] })} className="h-11 w-full rounded-xl border border-foreground/15 bg-foreground/5 px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/40">
                {resolvedStages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="crm-organization">{dictionary.contactDialog.fields.organization}</FieldLabel>
              <select id="crm-organization" value={value.organizationId ?? ""} onChange={(event) => setValue({ ...value, organizationId: event.target.value })} className="h-11 w-full rounded-xl border border-foreground/15 bg-foreground/5 px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/40">
                <option value="">{dictionary.contactDialog.placeholders.organization}</option>
                {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name ?? organization.id}</option>)}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="crm-owner">{dictionary.contactDialog.fields.owner}</FieldLabel>
              <select id="crm-owner" value={value.ownerId ?? ""} onChange={(event) => setValue({ ...value, ownerId: event.target.value })} className="h-11 w-full rounded-xl border border-foreground/15 bg-foreground/5 px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/40">
                <option value="">{dictionary.contactDialog.placeholders.owner}</option>
                {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}
              </select>
            </Field>
          </FieldGroup>
          <AlertDialogFooter>
            {contact && onTimeline ? <Button type="button" variant="ghost" onClick={() => onTimeline(contact)}>{dictionary.contactDialog.timeline}</Button> : null}
            {contact && onDelete ? <Button type="button" variant="ghost" onClick={() => onDelete(contact)}>{dictionary.contactDialog.delete}</Button> : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{dictionary.contactDialog.cancel}</Button>
            <Button type="submit" disabled={saving}>{saving ? dictionary.contactDialog.saving : contact ? dictionary.contactDialog.save : dictionary.contactDialog.create}</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
