"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@brightweblabs/ui";

import { defaultCrmUiDictionary } from "./dictionary";
import type { CrmUiDictionary } from "./types";

export type CrmDeleteDialogProps = {
  open: boolean;
  contactIds: string[];
  dictionary?: CrmUiDictionary;
  onOpenChange: (open: boolean) => void;
  onConfirm: (contactIds: string[]) => Promise<void> | void;
};

export function CrmDeleteDialog({ open, contactIds, dictionary = defaultCrmUiDictionary, onOpenChange, onConfirm }: CrmDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const submit = async () => {
    setDeleting(true);
    try {
      await onConfirm(contactIds);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{contactIds.length > 1 ? dictionary.deleteDialog.bulkTitle : dictionary.deleteDialog.singleTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {contactIds.length > 1 ? dictionary.deleteDialog.bulkDescription(contactIds.length) : dictionary.deleteDialog.singleDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{dictionary.deleteDialog.cancel}</Button>
          <Button type="button" disabled={deleting || contactIds.length === 0} onClick={() => void submit()}>
            {deleting ? dictionary.deleteDialog.deleting : dictionary.deleteDialog.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
