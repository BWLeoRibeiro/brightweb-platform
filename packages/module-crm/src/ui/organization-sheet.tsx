"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Building2, Pencil, Save } from "lucide-react";
import { AppSheetBody, AppSheetFooter, AppSheetHeader, SheetSection, sheetEditControlClassName, sheetShellClassName, sheetViewControlClassName } from "@brightweblabs/app-shell";
import { Button, Field, FieldContent, FieldGroup, FieldLabel, Input, Sheet, SheetContent } from "@brightweblabs/ui";
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
};

export function CrmOrganizationSheet({ open, organization, dictionary = defaultCrmUiDictionary, onOpenChange, onSubmit }: CrmOrganizationSheetProps) {
  const fieldId = useId();
  const [mode, setMode] = useState<OrganizationMode>(organization ? "view" : "create");
  const [value, setValue] = useState(() => initialValue(organization));
  const [saving, setSaving] = useState(false);
  const editing = mode !== "view";
  const controlClassName = editing ? sheetEditControlClassName : sheetViewControlClassName;

  useEffect(() => {
    if (!open) return;
    setValue(initialValue(organization));
    setMode(organization ? "view" : "create");
  }, [open, organization]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !value.name?.trim()) return;
    setSaving(true);
    try { await onSubmit(value, organization); onOpenChange(false); } finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={sheetShellClassName}>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-0">
          <AppSheetHeader icon={Building2} editing={editing} eyebrow={mode === "view" ? dictionary.organizations.viewEyebrow : mode === "edit" ? dictionary.organizations.editEyebrow : dictionary.organizations.createEyebrow} title={mode === "create" ? dictionary.organizations.newTitle : value.name || dictionary.contactDialog.noName} description={mode === "create" ? dictionary.organizations.createDescription : value.industry ? `${value.industry}${value.company_size ? ` · ${value.company_size} colaboradores` : ""}` : dictionary.organizations.fallbackDescription} />
          <AppSheetBody>
            <SheetSection title={dictionary.organizations.identity} editing={editing}>
              <FieldGroup className={`gap-0 px-0 py-1 ${editing ? "" : "divide-y divide-hairline"}`}>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-name`} className="text-[length:var(--text-ui-micro)] uppercase tracking-wider text-foreground-muted-accessible">{dictionary.organizations.name}</FieldLabel><FieldContent><Input id={`${fieldId}-name`} name="name" autoComplete="organization" value={value.name ?? ""} onChange={(event) => setValue({ ...value, name: event.target.value })} placeholder={dictionary.organizations.namePlaceholder} disabled={!editing} className={`${controlClassName} mt-1.5`} /></FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-industry`} className="text-[length:var(--text-ui-micro)] uppercase tracking-wider text-foreground-muted-accessible">{dictionary.organizations.industry}</FieldLabel><FieldContent><select id={`${fieldId}-industry`} name="industry" disabled={!editing} className={`${controlClassName} mt-1.5 text-foreground outline-none disabled:appearance-none`} value={value.industry ?? ""} onChange={(event) => setValue({ ...value, industry: event.target.value })}><option value="">{dictionary.organizations.selectIndustry}</option>{value.industry && !industries.includes(value.industry) ? <option value={value.industry}>{value.industry} (atual)</option> : null}{industries.map((industry) => <option key={industry} value={industry}>{industry}</option>)}</select></FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-website`} className="text-[length:var(--text-ui-micro)] uppercase tracking-wider text-foreground-muted-accessible">{dictionary.organizations.website}</FieldLabel><FieldContent><Input id={`${fieldId}-website`} name="website" autoComplete="url" type="url" value={value.website_url ?? ""} onChange={(event) => setValue({ ...value, website_url: event.target.value })} placeholder={dictionary.organizations.websitePlaceholder} disabled={!editing} className={`${controlClassName} mt-1.5`} /></FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-tax-identifier`} className="text-[length:var(--text-ui-micro)] uppercase tracking-wider text-foreground-muted-accessible">{dictionary.organizations.taxIdentifierLong}</FieldLabel><FieldContent><Input id={`${fieldId}-tax-identifier`} name="taxIdentifierValue" value={value.taxIdentifierValue ?? ""} onChange={(event) => setValue({ ...value, taxIdentifierValue: event.target.value })} placeholder={dictionary.organizations.taxIdentifierPlaceholder} inputMode="numeric" disabled={!editing} className={`${controlClassName} mt-1.5`} /></FieldContent></Field>
                <Field className="gap-1.5 px-4 py-2"><FieldLabel htmlFor={`${fieldId}-address`} className="text-[length:var(--text-ui-micro)] uppercase tracking-wider text-foreground-muted-accessible">{dictionary.organizations.address}</FieldLabel><FieldContent><Input id={`${fieldId}-address`} name="address" autoComplete="street-address" value={value.address ?? ""} onChange={(event) => setValue({ ...value, address: event.target.value })} placeholder={dictionary.organizations.addressPlaceholder} disabled={!editing} className={`${controlClassName} mt-1.5`} /></FieldContent></Field>
              </FieldGroup>
            </SheetSection>
            <SheetSection title={dictionary.organizations.profile} editing={editing}>
              <FieldGroup className="grid grid-cols-2 gap-3 px-4 py-3">
                <Field><FieldLabel htmlFor={`${fieldId}-company-size`} className="text-[length:var(--text-ui-micro)] uppercase tracking-wider text-foreground-muted-accessible">{dictionary.organizations.companySize}</FieldLabel><select id={`${fieldId}-company-size`} name="companySize" disabled={!editing} className={`${controlClassName} mt-1.5 text-foreground outline-none disabled:appearance-none`} value={value.company_size ?? ""} onChange={(event) => setValue({ ...value, company_size: event.target.value })}><option value="">—</option>{companySizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></Field>
                <Field><FieldLabel htmlFor={`${fieldId}-budget-range`} className="text-[length:var(--text-ui-micro)] uppercase tracking-wider text-foreground-muted-accessible">{dictionary.organizations.budgetRange}</FieldLabel><select id={`${fieldId}-budget-range`} name="budgetRange" disabled={!editing} className={`${controlClassName} mt-1.5 text-foreground outline-none disabled:appearance-none`} value={value.budget_range ?? ""} onChange={(event) => setValue({ ...value, budget_range: event.target.value })}><option value="">—</option>{budgetRanges.map((range) => <option key={range} value={range}>{range}</option>)}</select></Field>
              </FieldGroup>
            </SheetSection>
          </AppSheetBody>
          <AppSheetFooter className={editing ? "flex-row" : undefined}>{mode === "view" ? <Button type="button" className="w-full" onClick={() => setMode("edit")}><Pencil className="mr-2 size-4" />{dictionary.organizations.edit}</Button> : <><Button type="submit" className="flex-1" disabled={saving || !value.name?.trim()}><Save className="mr-2 size-4" />{saving ? dictionary.organizations.saving : dictionary.organizations.save}</Button><Button type="button" variant="outline" className="flex-1" onClick={() => organization ? (setValue(initialValue(organization)), setMode("view")) : onOpenChange(false)}>{dictionary.organizations.cancel}</Button></>}</AppSheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
