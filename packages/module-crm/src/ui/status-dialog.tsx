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
  FieldDescription,
  FieldLabel,
  Input,
} from "@brightweblabs/ui";

import type { CrmContactStatus } from "../server";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import type { CrmStageConfig, CrmUiDictionary } from "./types";

export type CrmStatusDialogProps = {
  open: boolean;
  contactIds: string[];
  initialStatus?: CrmContactStatus;
  dictionary?: CrmUiDictionary;
  stages?: CrmStageConfig[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (status: CrmContactStatus, reason?: string | null) => Promise<void> | void;
};

export function CrmStatusDialog({ open, contactIds, initialStatus = "lead", dictionary = defaultCrmUiDictionary, stages, onOpenChange, onSubmit }: CrmStatusDialogProps) {
  const [status, setStatus] = useState<CrmContactStatus>(initialStatus);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const resolvedStages = resolveCrmStages(dictionary, stages);

  useEffect(() => {
    if (open) {
      setStatus(initialStatus);
      setReason("");
    }
  }, [initialStatus, open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(status, reason.trim() || null);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form onSubmit={submit}>
          <AlertDialogHeader>
            <AlertDialogTitle>{status === "lost" ? dictionary.statusDialog.lossTitle : contactIds.length > 1 ? dictionary.statusDialog.bulkTitle : dictionary.statusDialog.singleTitle}</AlertDialogTitle>
            <AlertDialogDescription>{status === "lost" ? dictionary.statusDialog.lossDescription : dictionary.statusDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-5 grid gap-4">
            <Field>
              <FieldLabel htmlFor="crm-new-status">{dictionary.statusDialog.status}</FieldLabel>
              <select id="crm-new-status" value={status} onChange={(event) => setStatus(event.target.value as CrmContactStatus)} className="h-11 w-full rounded-xl border border-foreground/15 bg-foreground/5 px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/40">
                {resolvedStages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
              </select>
            </Field>
            <Field className={status === "lost" ? "rounded-[var(--radius-card)] border border-[color:var(--crm-stage-lost)] bg-[color:var(--surface-danger-subtle)] p-4" : undefined}>
              <FieldLabel htmlFor="crm-status-reason">{dictionary.statusDialog.reason}</FieldLabel>
              <Input id="crm-status-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={dictionary.statusDialog.reasonPlaceholder} />
              {status === "lost" ? <FieldDescription className="text-[color:var(--crm-stage-lost-strong)]">{dictionary.statusDialog.lossReasonHint}</FieldDescription> : null}
            </Field>
          </div>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{dictionary.statusDialog.cancel}</Button>
            <Button type="submit" disabled={saving || contactIds.length === 0 || (status === "lost" && !reason.trim())}>{saving ? dictionary.statusDialog.saving : dictionary.statusDialog.confirm}</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
