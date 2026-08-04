"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Building2, Pencil, Save, Trash2 } from "lucide-react";
import { AppSheetBody, AppSheetFooter, AppSheetHeader, SheetSection, SheetSelect, sheetEditControlClassName, sheetFieldLabelClassName, sheetShellClassName, sheetViewControlClassName } from "@brightweblabs/app-shell";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  Input,
  Sheet,
  SheetContent,
} from "@brightweblabs/ui";
import type { CrmOrganization, CrmOrganizationWriteInput, CrmUiDictionary } from "./types";
import { defaultCrmUiDictionary } from "./dictionary";

export type CrmOrganizationFormInput = CrmOrganizationWriteInput;
type OrganizationMode = "create" | "view" | "edit";

const industries = ["Agricultura", "Alimentação e Bebidas", "Construção", "Educação", "Energia", "Financeiro", "Imobiliário", "Indústria Transformadora", "Logística e Transportes", "Retalho", "Saúde", "Tecnologia", "Turismo e Hotelaria"];
const companySizes = ["1", "1-10", "10-50", "50-100", "100++"];
const budgetRanges = ["Até 5.000 €", "5.000 € - 10.000 €", "10.000 € - 25.000 €", "25.000 € - 50.000 €", "50.000 € - 100.000 €", "100.000 €+"];

function initialValue(organization?: CrmOrganization | null): CrmOrganizationFormInput {
  return { name: organization?.name ?? "", industry: organization?.industry ?? "", company_size: organization?.company_size ?? "", budget_range: organization?.budget_range ?? "", website_url: organization?.website_url ?? "", address: organization?.address ?? "", taxIdentifierValue: organization?.taxIdentifierValue ?? "", primary_contact_id: organization?.primary_contact_id ?? null };
}

export type CrmOrganizationSheetProps = {
  open: boolean;
  organization?: CrmOrganization | null;
  dictionary?: CrmUiDictionary;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CrmOrganizationFormInput, organization?: CrmOrganization | null) => Promise<void> | void;
  onDelete?: (organization: CrmOrganization) => Promise<void> | void;
  listInvitations?: (organizationId: string) => Promise<Array<{ id: string; email: string; role: "admin" | "member" }>>;
  onRevokeInvitation?: (organizationId: string, invitationId: string) => Promise<void>;
};

export function CrmOrganizationSheet({ open, organization, dictionary = defaultCrmUiDictionary, onOpenChange, onSubmit, onDelete, listInvitations, onRevokeInvitation }: CrmOrganizationSheetProps) {
  const fieldId = useId();
  const [mode, setMode] = useState<OrganizationMode>(organization ? "view" : "create");
  const [value, setValue] = useState(() => initialValue(organization));
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [invitations, setInvitations] = useState<Array<{ id: string; email: string; role: "admin" | "member" }>>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const editing = mode !== "view";
  const controlClassName = editing ? sheetEditControlClassName : sheetViewControlClassName;
  const deleteConfirmationTarget = organization?.name && organization.name.trim().length > 0 ? organization.name : organization?.id ?? "";

  useEffect(() => {
    if (!open) return;
    setValue(initialValue(organization));
    setMode(organization ? "view" : "create");
    setInvitations([]);
    setOperationError(null);
    setDeleteDialogOpen(false);
    setDeleteConfirmation("");
  }, [open, organization]);

  useEffect(() => {
    if (!open || !organization || !listInvitations) return;
    let current = true;
    void listInvitations(organization.id)
      .then((items) => { if (current) setInvitations(items); })
      .catch((error) => { if (current) setOperationError(error instanceof Error ? error.message : "Não foi possível carregar os convites."); });
    return () => { current = false; };
  }, [listInvitations, open, organization]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !editing || !value.name?.trim()) return;
    setSaving(true);
    try { await onSubmit(value, organization); onOpenChange(false); } finally { setSaving(false); }
  };

  const handleSheetOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && editing) return;
    onOpenChange(nextOpen);
  };

  const remove = async () => {
    if (!organization || !onDelete || saving) return;
    if (deleteConfirmation !== deleteConfirmationTarget) return;
    setOperationError(null);
    setSaving(true);
    try {
      await onDelete(organization);
      setDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Não foi possível eliminar a organização.");
    } finally {
      setSaving(false);
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    if (!organization || !onRevokeInvitation || !window.confirm("Revogar este convite pendente?")) return;
    setSaving(true);
    try {
      await onRevokeInvitation(organization.id, invitationId);
      setInvitations((items) => items.filter((item) => item.id !== invitationId));
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Não foi possível revogar o convite.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent
        className={sheetShellClassName}
        showCloseButton={!editing}
        onInteractOutside={(event) => {
          if (editing) event.preventDefault();
        }}
      >
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-0">
          <AppSheetHeader icon={Building2} editing={editing} eyebrow={mode === "view" ? dictionary.organizations.viewEyebrow : mode === "edit" ? dictionary.organizations.editEyebrow : dictionary.organizations.createEyebrow} title={mode === "create" ? dictionary.organizations.newTitle : value.name || dictionary.contactDialog.noName} description={mode === "create" ? dictionary.organizations.createDescription : value.industry ? `${value.industry}${value.company_size ? ` · ${value.company_size} colaboradores` : ""}` : dictionary.organizations.fallbackDescription} />
          <AppSheetBody>
            {operationError ? <p role="alert" className="mx-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-meta text-destructive">{operationError}</p> : null}
            <SheetSection title={dictionary.organizations.identity} editing={editing}>
              <FieldGroup className={`gap-0 px-0 py-1 ${editing ? "" : "divide-y divide-hairline"}`}>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-name`} className={sheetFieldLabelClassName}>{dictionary.organizations.name}</FieldLabel><FieldContent><Input id={`${fieldId}-name`} name="name" autoComplete="organization" value={value.name ?? ""} onChange={(event) => setValue({ ...value, name: event.target.value })} placeholder={dictionary.organizations.namePlaceholder} disabled={!editing} className={`${controlClassName} mt-1.5`} /></FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-industry`} className={sheetFieldLabelClassName}>{dictionary.organizations.industry}</FieldLabel><FieldContent>{editing ? <SheetSelect id={`${fieldId}-industry`} name="industry" className="mt-1.5" value={value.industry ?? ""} onValueChange={(industry) => setValue({ ...value, industry })} options={[{ value: "", label: dictionary.organizations.selectIndustry }, ...(value.industry && !industries.includes(value.industry) ? [{ value: value.industry, label: `${value.industry} (atual)` }] : []), ...industries.map((industry) => ({ value: industry, label: industry }))]} /> : <p className="mt-1.5 text-body text-foreground/75">{value.industry || "—"}</p>}</FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-website`} className={sheetFieldLabelClassName}>{dictionary.organizations.website}</FieldLabel><FieldContent><Input id={`${fieldId}-website`} name="website" autoComplete="url" type="url" value={value.website_url ?? ""} onChange={(event) => setValue({ ...value, website_url: event.target.value })} placeholder={dictionary.organizations.websitePlaceholder} disabled={!editing} className={`${controlClassName} mt-1.5`} /></FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-tax-identifier`} className={sheetFieldLabelClassName}>{dictionary.organizations.taxIdentifierLong}</FieldLabel><FieldContent><Input id={`${fieldId}-tax-identifier`} name="taxIdentifierValue" value={value.taxIdentifierValue ?? ""} onChange={(event) => setValue({ ...value, taxIdentifierValue: event.target.value })} placeholder={dictionary.organizations.taxIdentifierPlaceholder} inputMode="numeric" disabled={!editing} className={`${controlClassName} mt-1.5`} /></FieldContent></Field>
              </FieldGroup>
            </SheetSection>
            <SheetSection title={dictionary.organizations.location} editing={editing}>
              <FieldGroup className={`gap-0 px-0 py-1 ${editing ? "" : "divide-y divide-hairline"}`}>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-address`} className={sheetFieldLabelClassName}>{dictionary.organizations.address}</FieldLabel><FieldContent><Input id={`${fieldId}-address`} name="address" autoComplete="street-address" value={value.address ?? ""} onChange={(event) => setValue({ ...value, address: event.target.value })} placeholder={dictionary.organizations.addressPlaceholder} disabled={!editing} className={`${controlClassName} mt-1.5`} /></FieldContent></Field>
              </FieldGroup>
            </SheetSection>
            {mode === "view" && invitations.length > 0 ? (
              <SheetSection title="Convites pendentes" editing={false}>
                <div className="divide-y divide-hairline">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1"><p className="truncate text-body">{invitation.email}</p><p className="text-meta text-muted-foreground">{invitation.role === "admin" ? "Administrador" : "Membro"}</p></div>
                      <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void revokeInvitation(invitation.id)}>Revogar</Button>
                    </div>
                  ))}
                </div>
              </SheetSection>
            ) : null}
            {mode === "view" && organization && onDelete ? (
              <div className="mx-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-body font-semibold text-destructive">Zona de perigo</p>
                <p className="mt-1 text-meta text-muted-foreground">A eliminação remove membros e convites, desassocia contactos e é bloqueada enquanto existirem projetos.</p>
                <Button type="button" variant="destructive" className="mt-3" disabled={saving} onClick={() => { setOperationError(null); setDeleteConfirmation(""); setDeleteDialogOpen(true); }}>
                  <Trash2 className="mr-2 size-4" />Eliminar organização
                </Button>
              </div>
            ) : null}
            <SheetSection title={dictionary.organizations.profile} editing={editing}>
              <FieldGroup className="grid gap-3 px-4 py-3 sm:grid-cols-2">
                <Field><FieldLabel htmlFor={`${fieldId}-company-size`} className={sheetFieldLabelClassName}>{dictionary.organizations.companySize}</FieldLabel>{editing ? <SheetSelect id={`${fieldId}-company-size`} name="companySize" className="mt-1.5" value={value.company_size ?? ""} onValueChange={(company_size) => setValue({ ...value, company_size })} options={[{ value: "", label: "—" }, ...companySizes.map((size) => ({ value: size, label: size }))]} /> : <p className="mt-1.5 text-body text-foreground/75">{value.company_size || "—"}</p>}</Field>
                <Field><FieldLabel htmlFor={`${fieldId}-budget-range`} className={sheetFieldLabelClassName}>{dictionary.organizations.budgetRange}</FieldLabel>{editing ? <SheetSelect id={`${fieldId}-budget-range`} name="budgetRange" className="mt-1.5" value={value.budget_range ?? ""} onValueChange={(budget_range) => setValue({ ...value, budget_range })} options={[{ value: "", label: "—" }, ...budgetRanges.map((range) => ({ value: range, label: range }))]} /> : <p className="mt-1.5 text-body text-foreground/75">{value.budget_range || "—"}</p>}</Field>
              </FieldGroup>
            </SheetSection>
          </AppSheetBody>
          <AppSheetFooter className={editing ? "flex-row" : undefined}>{mode === "view" ? <Button type="button" className="w-full" onClick={() => setMode("edit")}><Pencil className="mr-2 size-4" />{dictionary.organizations.edit}</Button> : <><Button type="submit" className="flex-1" disabled={saving || !value.name?.trim()}><Save className="mr-2 size-4" />{saving ? dictionary.organizations.saving : mode === "create" ? dictionary.organizations.create : dictionary.organizations.save}</Button><Button type="button" variant="outline" className="flex-1" onClick={() => organization ? (setValue(initialValue(organization)), setMode("view")) : onOpenChange(false)}>{dictionary.organizations.cancel}</Button></>}</AppSheetFooter>
        </form>
      </SheetContent>
      <AlertDialog open={deleteDialogOpen} onOpenChange={(next) => { if (!saving) setDeleteDialogOpen(next); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar organização?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. Para confirmar, escreva exatamente <strong>{deleteConfirmationTarget}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            aria-label="Nome da organização para confirmar"
            autoComplete="off"
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            disabled={saving}
          />
          {operationError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-meta text-destructive">{operationError}</p> : null}
          <AlertDialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button type="button" variant="destructive" disabled={saving || !organization || deleteConfirmation !== deleteConfirmationTarget} onClick={() => void remove()}>
              {saving ? "A eliminar…" : "Eliminar definitivamente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
