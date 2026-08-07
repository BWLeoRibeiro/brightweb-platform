"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Building2, Plus, Save } from "lucide-react";
import {
  AppSheetBody,
  AppSheetFooter,
  AppSheetHeader,
  SheetSection,
  SheetSelect,
  sheetEditControlClassName,
  sheetFieldLabelClassName,
  sheetShellClassName,
} from "@brightweblabs/app-shell";
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
  FieldGroup,
  FieldLabel,
  Input,
  Sheet,
  SheetContent,
} from "@brightweblabs/ui";

export type OrganizationCreateInvitation = {
  email: string;
  role: "admin" | "member";
};

export type OrganizationCreateSheetInput = {
  name: string;
  industry?: string | null;
  companySize?: string | null;
  budgetRange?: string | null;
  websiteUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  zipCode?: string | null;
  country?: string | null;
  taxIdentifierValue?: string | null;
  invitations: OrganizationCreateInvitation[];
};

export type OrganizationCreateSheetDictionary = {
  eyebrow: string;
  title: string;
  description: string;
  identity: string;
  name: string;
  namePlaceholder: string;
  industry: string;
  selectIndustry: string;
  website: string;
  websitePlaceholder: string;
  taxIdentifier: string;
  taxIdentifierPlaceholder: string;
  location: string;
  address: string;
  addressPlaceholder: string;
  addressLine2: string;
  addressLine2Placeholder: string;
  zipCode: string;
  country: string;
  profile: string;
  companySize: string;
  budgetRange: string;
  members: string;
  emailPlaceholder: string;
  member: string;
  admin: string;
  add: string;
  remove: string;
  optionalInvites: string;
  inviteHint: string;
  invalidEmail: string;
  create: string;
  creating: string;
  cancel: string;
  createError: string;
  discardTitle: string;
  discardDescription: string;
  continueEditing: string;
  discard: string;
};

export const defaultOrganizationCreateSheetDictionary: OrganizationCreateSheetDictionary = {
  eyebrow: "A criar",
  title: "Nova organização",
  description: "Cria a organização e, opcionalmente, convida os seus membros.",
  identity: "Identificação",
  name: "Nome",
  namePlaceholder: "Empresa Verde, Lda.",
  industry: "Setor",
  selectIndustry: "Selecionar setor",
  website: "Website",
  websitePlaceholder: "https://empresa.pt",
  taxIdentifier: "NIF",
  taxIdentifierPlaceholder: "123456789",
  location: "Localização",
  address: "Morada",
  addressPlaceholder: "Rua Exemplo, 120",
  addressLine2: "Complemento",
  addressLine2Placeholder: "Andar, porta, edifício…",
  zipCode: "Código postal",
  country: "País",
  profile: "Perfil",
  companySize: "Dimensão",
  budgetRange: "Orçamento",
  members: "Membros",
  emailPlaceholder: "email@empresa.pt",
  member: "Membro",
  admin: "Administrador",
  add: "Adicionar",
  remove: "Remover",
  optionalInvites: "Os convites são opcionais.",
  inviteHint: "Os membros existentes são adicionados diretamente; os restantes recebem um convite.",
  invalidEmail: "Introduz um email válido.",
  create: "Criar organização",
  creating: "A criar…",
  cancel: "Cancelar",
  createError: "Não foi possível criar a organização.",
  discardTitle: "Descartar alterações?",
  discardDescription: "Os dados desta nova organização ainda não foram guardados.",
  continueEditing: "Continuar a editar",
  discard: "Descartar",
};

const industries = ["Agricultura", "Alimentação e Bebidas", "Construção", "Educação", "Energia", "Financeiro", "Imobiliário", "Indústria Transformadora", "Logística e Transportes", "Retalho", "Saúde", "Tecnologia", "Turismo e Hotelaria"];
const companySizes = ["1", "1-10", "10-50", "50-100", "100++"];
const budgetRanges = ["Até 5.000 €", "5.000 € - 10.000 €", "10.000 € - 25.000 €", "25.000 € - 50.000 €", "50.000 € - 100.000 €", "100.000 €+"];

const emptyValue: Omit<OrganizationCreateSheetInput, "invitations"> = {
  name: "",
  industry: "",
  companySize: "",
  budgetRange: "",
  websiteUrl: "",
  addressLine1: "",
  addressLine2: "",
  zipCode: "",
  country: "",
  taxIdentifierValue: "",
};

export function addOrganizationCreateInvitation(
  current: OrganizationCreateInvitation[],
  draft: OrganizationCreateInvitation,
) {
  const email = draft.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, invitations: current };
  if (current.some((item) => item.email === email)) return { valid: true, invitations: current };
  return { valid: true, invitations: [...current, { email, role: draft.role }] };
}

export function buildOrganizationCreateSheetInput(
  value: Omit<OrganizationCreateSheetInput, "invitations">,
  invitations: OrganizationCreateInvitation[],
): OrganizationCreateSheetInput {
  return { ...value, invitations };
}

export type OrganizationCreateSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: OrganizationCreateSheetInput) => Promise<void> | void;
  dictionary?: Partial<OrganizationCreateSheetDictionary>;
};

export function OrganizationCreateSheet({ open, onOpenChange, onSubmit, dictionary: dictionaryOverrides }: OrganizationCreateSheetProps) {
  const dictionary = { ...defaultOrganizationCreateSheetDictionary, ...dictionaryOverrides };
  const fieldId = useId();
  const [value, setValue] = useState(emptyValue);
  const [inviteDraft, setInviteDraft] = useState<OrganizationCreateInvitation>({ email: "", role: "member" });
  const [invitations, setInvitations] = useState<OrganizationCreateInvitation[]>([]);
  const [saving, setSaving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(emptyValue);
    setInviteDraft({ email: "", role: "member" });
    setInvitations([]);
    setOperationError(null);
  }, [open]);

  const addInvitation = () => {
    const result = addOrganizationCreateInvitation(invitations, inviteDraft);
    if (!result.valid) {
      setOperationError(dictionary.invalidEmail);
      return;
    }
    setOperationError(null);
    setInvitations(result.invitations);
    setInviteDraft({ email: "", role: "member" });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !value.name.trim()) return;
    setOperationError(null);
    setSaving(true);
    try {
      await onSubmit(buildOrganizationCreateSheetInput(value, invitations));
      onOpenChange(false);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : dictionary.createError);
    } finally {
      setSaving(false);
    }
  };

  const hasDraft = Object.values(value).some((field) => Boolean(field?.trim()))
    || Boolean(inviteDraft.email.trim())
    || invitations.length > 0;
  const requestClose = () => {
    if (hasDraft) setDiscardOpen(true);
    else onOpenChange(false);
  };

  return (
    <>
    <Sheet open={open} onOpenChange={(next) => { if (next) onOpenChange(true); }}>
      <SheetContent className={sheetShellClassName} showCloseButton={false} onInteractOutside={(event) => event.preventDefault()}>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-0">
          <AppSheetHeader icon={Building2} editing eyebrow={dictionary.eyebrow} title={dictionary.title} description={dictionary.description} />
          <AppSheetBody>
            {operationError ? <p role="alert" className="mx-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-meta text-destructive">{operationError}</p> : null}
            <SheetSection title={dictionary.identity} editing>
              <FieldGroup className="gap-0 px-0 py-1">
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-name`} className={sheetFieldLabelClassName}>{dictionary.name}</FieldLabel><FieldContent><Input id={`${fieldId}-name`} autoComplete="organization" value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} placeholder={dictionary.namePlaceholder} className={`${sheetEditControlClassName} mt-1.5`} /></FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel className={sheetFieldLabelClassName}>{dictionary.industry}</FieldLabel><FieldContent><SheetSelect className="mt-1.5" value={value.industry ?? ""} onValueChange={(industry) => setValue({ ...value, industry })} options={[{ value: "", label: dictionary.selectIndustry }, ...industries.map((industry) => ({ value: industry, label: industry }))]} /></FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-website`} className={sheetFieldLabelClassName}>{dictionary.website}</FieldLabel><FieldContent><Input id={`${fieldId}-website`} type="url" autoComplete="url" value={value.websiteUrl ?? ""} onChange={(event) => setValue({ ...value, websiteUrl: event.target.value })} placeholder={dictionary.websitePlaceholder} className={`${sheetEditControlClassName} mt-1.5`} /></FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-tax`} className={sheetFieldLabelClassName}>{dictionary.taxIdentifier}</FieldLabel><FieldContent><Input id={`${fieldId}-tax`} inputMode="numeric" value={value.taxIdentifierValue ?? ""} onChange={(event) => setValue({ ...value, taxIdentifierValue: event.target.value.replace(/\D/g, "") })} placeholder={dictionary.taxIdentifierPlaceholder} className={`${sheetEditControlClassName} mt-1.5`} /></FieldContent></Field>
              </FieldGroup>
            </SheetSection>
            <SheetSection title={dictionary.location} editing>
              <FieldGroup className="grid gap-3 px-4 py-3 sm:grid-cols-2">
                <Field className="sm:col-span-2"><FieldLabel htmlFor={`${fieldId}-address`} className={sheetFieldLabelClassName}>{dictionary.address}</FieldLabel><Input id={`${fieldId}-address`} autoComplete="street-address" value={value.addressLine1 ?? ""} onChange={(event) => setValue({ ...value, addressLine1: event.target.value })} placeholder={dictionary.addressPlaceholder} className={`${sheetEditControlClassName} mt-1.5`} /></Field>
                <Field className="sm:col-span-2"><FieldLabel htmlFor={`${fieldId}-address-2`} className={sheetFieldLabelClassName}>{dictionary.addressLine2}</FieldLabel><Input id={`${fieldId}-address-2`} value={value.addressLine2 ?? ""} onChange={(event) => setValue({ ...value, addressLine2: event.target.value })} placeholder={dictionary.addressLine2Placeholder} className={`${sheetEditControlClassName} mt-1.5`} /></Field>
                <Field><FieldLabel htmlFor={`${fieldId}-zip`} className={sheetFieldLabelClassName}>{dictionary.zipCode}</FieldLabel><Input id={`${fieldId}-zip`} autoComplete="postal-code" value={value.zipCode ?? ""} onChange={(event) => setValue({ ...value, zipCode: event.target.value })} className={`${sheetEditControlClassName} mt-1.5`} /></Field>
                <Field><FieldLabel htmlFor={`${fieldId}-country`} className={sheetFieldLabelClassName}>{dictionary.country}</FieldLabel><Input id={`${fieldId}-country`} autoComplete="country-name" value={value.country ?? ""} onChange={(event) => setValue({ ...value, country: event.target.value })} className={`${sheetEditControlClassName} mt-1.5`} /></Field>
              </FieldGroup>
            </SheetSection>
            <SheetSection title={dictionary.profile} editing>
              <FieldGroup className="grid gap-3 px-4 py-3 sm:grid-cols-2">
                <Field><FieldLabel className={sheetFieldLabelClassName}>{dictionary.companySize}</FieldLabel><SheetSelect className="mt-1.5" value={value.companySize ?? ""} onValueChange={(companySize) => setValue({ ...value, companySize })} options={[{ value: "", label: "—" }, ...companySizes.map((size) => ({ value: size, label: size }))]} /></Field>
                <Field><FieldLabel className={sheetFieldLabelClassName}>{dictionary.budgetRange}</FieldLabel><SheetSelect className="mt-1.5" value={value.budgetRange ?? ""} onValueChange={(budgetRange) => setValue({ ...value, budgetRange })} options={[{ value: "", label: "—" }, ...budgetRanges.map((range) => ({ value: range, label: range }))]} /></Field>
              </FieldGroup>
            </SheetSection>
            <SheetSection title={dictionary.members} editing bodyClassName="space-y-3 px-4 py-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Input type="email" value={inviteDraft.email} onChange={(event) => setInviteDraft({ ...inviteDraft, email: event.target.value })} placeholder={dictionary.emailPlaceholder} className="h-8" />
                <SheetSelect
                  aria-label={dictionary.members}
                  className="h-8"
                  value={inviteDraft.role}
                  onValueChange={(role) => setInviteDraft({ ...inviteDraft, role: role === "admin" ? "admin" : "member" })}
                  options={[
                    { value: "member", label: dictionary.member },
                    { value: "admin", label: dictionary.admin },
                  ]}
                />
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={addInvitation}><Plus className="mr-1 size-3" />{dictionary.add}</Button>
              </div>
              {invitations.length === 0 ? <p className="text-meta text-foreground/55">{dictionary.optionalInvites}</p> : <div className="space-y-1.5">{invitations.map((invitation) => <div key={invitation.email} className="flex items-center justify-between rounded-lg border border-black/8 bg-background/60 px-2.5 py-1.5 text-meta dark:border-white/12"><span className="truncate">{invitation.email}</span><div className="flex items-center gap-2"><span className="rounded-full border px-2 py-0.5 text-micro font-semibold">{invitation.role === "admin" ? dictionary.admin : dictionary.member}</span><button type="button" className="text-destructive" onClick={() => setInvitations((current) => current.filter((item) => item.email !== invitation.email))}>{dictionary.remove}</button></div></div>)}</div>}
              <p className="text-meta text-foreground/55">{dictionary.inviteHint}</p>
            </SheetSection>
          </AppSheetBody>
          <AppSheetFooter className="flex-row"><Button type="submit" className="flex-1" disabled={saving || !value.name.trim()}><Save className="mr-2 size-4" />{saving ? dictionary.creating : dictionary.create}</Button><Button type="button" variant="outline" className="flex-1" disabled={saving} onClick={requestClose}>{dictionary.cancel}</Button></AppSheetFooter>
        </form>
      </SheetContent>
    </Sheet>
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dictionary.discardTitle}</AlertDialogTitle>
          <AlertDialogDescription>{dictionary.discardDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{dictionary.continueEditing}</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { setDiscardOpen(false); onOpenChange(false); }}>
            {dictionary.discard}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
