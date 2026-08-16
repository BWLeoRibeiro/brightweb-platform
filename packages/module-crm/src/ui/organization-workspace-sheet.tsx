"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, Pencil, Send, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { AppSheetBody, AppSheetHeader, PillTabs, SheetSection, SheetSelect, sheetEditControlClassName, sheetFieldLabelClassName, sheetShellClassName } from "@brightweblabs/app-shell";
import { Badge, Button, EmptyState, Field, FieldContent, FieldLabel, Input, Sheet, SheetContent, Skeleton } from "@brightweblabs/ui";

import type { CrmContact } from "../data";
import { CrmOrganizationSheet, type CrmOrganizationFormInput } from "./organization-sheet";
import type { CrmOrganization, CrmOrganizationAccess, CrmOrganizationInvitation, CrmOrganizationMember, CrmUiClient } from "./types";

type WorkspaceTab = "info" | "people";

export type CrmOrganizationWorkspaceSheetProps = {
  open: boolean;
  organization: CrmOrganization | null;
  client: CrmUiClient;
  onOpenChange: (open: boolean) => void;
  onOrganizationChange?: (organization: CrmOrganization) => void;
  onOpenContact?: (contact: CrmContact) => void;
};

function contactName(contact: CrmContact) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Sem nome";
}

export function CrmOrganizationWorkspaceSheet({ open, organization, client, onOpenChange, onOrganizationChange, onOpenContact }: CrmOrganizationWorkspaceSheetProps) {
  const [tab, setTab] = useState<WorkspaceTab>("info");
  const [access, setAccess] = useState<CrmOrganizationAccess>({ members: [], invitations: [] });
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    try {
      const [nextAccess, contactResult] = await Promise.all([
        client.getOrganizationAccess(organization.id, { includeHistory: true }),
        client.listContacts({ organizationId: organization.id, page: 1, pageSize: 100, sort: "name" }),
      ]);
      setAccess(nextAccess);
      setContacts(contactResult.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar a organização.");
    } finally {
      setLoading(false);
    }
  }, [client, organization]);

  useEffect(() => {
    if (!open) return;
    setTab("info");
    setAddMemberOpen(false);
    setEmail("");
    setRole("member");
    void load();
  }, [load, open]);

  if (!organization) return null;
  const pending = access.invitations.filter((invitation) => invitation.status === "pending");

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized || saving) return;
    setSaving(true);
    try {
      const outcome = await client.inviteOrganizationMember(organization.id, { email: normalized, role });
      const successful = outcome.status !== "email_failed" && outcome.status !== "api_failed";
      if (successful) {
        setEmail("");
        setAddMemberOpen(false);
      }
      await load();
      const message = outcome.status === "immediate_access" ? "Acesso concedido imediatamente."
        : outcome.status === "membership_updated" ? "Função do membro atualizada."
          : outcome.status === "already_member" ? "Esta pessoa já é membro."
            : outcome.status === "pending_invitation" ? "Convite enviado por email."
              : outcome.status === "duplicate_pending" ? "Já existe um convite pendente."
                : outcome.message || "Não foi possível preparar o acesso.";
      if (successful) toast.success(message); else toast.error(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar o membro.");
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (member: CrmOrganizationMember, nextRole: "admin" | "member") => {
    if (nextRole === member.role) return;
    try {
      await client.updateOrganizationMemberRole(organization.id, member.profileId, nextRole);
      setAccess((current) => ({ ...current, members: current.members.map((item) => item.profileId === member.profileId ? { ...item, role: nextRole } : item) }));
      toast.success("Função atualizada.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a função."); }
  };

  const removeMember = async (member: CrmOrganizationMember) => {
    if (!window.confirm(`Remover o acesso de ${member.label}?`)) return;
    try {
      await client.removeOrganizationMember(organization.id, member.profileId);
      setAccess((current) => ({ ...current, members: current.members.filter((item) => item.profileId !== member.profileId) }));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível remover o acesso."); }
  };

  const revoke = async (invitation: CrmOrganizationInvitation) => {
    try {
      await client.revokeOrganizationInvitation(organization.id, invitation.id);
      setAccess((current) => ({ ...current, invitations: current.invitations.map((item) => item.id === invitation.id ? { ...item, status: "revoked" } : item) }));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível revogar o convite."); }
  };

  const resend = async (invitation: CrmOrganizationInvitation) => {
    try {
      await client.resendOrganizationInvitation(organization.id, invitation.id);
      toast.success("Convite reenviado.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível reenviar o convite."); }
  };

  const updateOrganization = async (input: CrmOrganizationFormInput) => {
    const updated = await client.updateOrganization(organization.id, input);
    onOrganizationChange?.(updated);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader icon={Building2} title={organization.name ?? "Organização"} description={organization.industry || "Registo CRM da organização"} aside={tab === "info" ? <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="mr-1.5 size-3.5" />Editar</Button> : undefined} />
          <div className="px-5 pt-3">
            <PillTabs ariaLabel="Organização" items={[{ value: "info", label: "Informação" }, { value: "people", label: `Membros · ${access.members.length}` }]} value={tab} onValueChange={setTab} />
          </div>
          {loading ? <AppSheetBody><Skeleton className="h-40 rounded-[var(--radius-card)]" /><Skeleton className="h-52 rounded-[var(--radius-card)]" /></AppSheetBody> : tab === "info" ? (
            <AppSheetBody>
              <SheetSection title="Informação da organização" bodyClassName="divide-y divide-[color:var(--border)] px-4">
                <dl className="text-body"><div className="flex justify-between gap-4 py-3"><dt className="text-[color:var(--muted-foreground)]">Indústria</dt><dd className="text-right font-semibold">{organization.industry || "—"}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-[color:var(--muted-foreground)]">Dimensão</dt><dd className="font-semibold">{organization.company_size || "—"}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-[color:var(--muted-foreground)]">Morada</dt><dd className="text-right font-semibold">{organization.address || "—"}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-[color:var(--muted-foreground)]">Website</dt><dd className="max-w-52 truncate font-semibold">{organization.website_url || "—"}</dd></div></dl>
              </SheetSection>
              <SheetSection title={`Contactos CRM · ${contacts.length}`} bodyClassName="divide-y divide-[color:var(--border)]">
                {contacts.map((contact) => <button type="button" key={contact.id} className="block w-full px-4 py-3 text-left transition-colors hover:bg-[color:var(--elevate-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ring)]" onClick={() => onOpenContact?.(contact)}><p className="truncate text-body font-semibold">{contactName(contact)}</p><p className="truncate text-meta text-[color:var(--muted-foreground)]">{contact.email || "Sem email"}</p></button>)}
                {contacts.length === 0 ? <EmptyState icon={Users} title="Sem contactos" hint="Ainda não existem contactos ligados a esta organização." /> : null}
              </SheetSection>
            </AppSheetBody>
          ) : (
            <AppSheetBody>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0"><p className="text-body font-semibold text-[color:var(--foreground)]">Acesso à organização</p><p className="mt-0.5 text-meta text-[color:var(--muted-foreground)]">{access.members.length} {access.members.length === 1 ? "membro" : "membros"} · {pending.length} {pending.length === 1 ? "convite pendente" : "convites pendentes"}</p></div>
                <Button type="button" variant={addMemberOpen ? "outline" : "brand"} size="sm" onClick={() => setAddMemberOpen((current) => !current)}><UserPlus className="size-4" />{addMemberOpen ? "Cancelar" : "Adicionar membro"}</Button>
              </div>
              {addMemberOpen ? <SheetSection title="Adicionar membro" editing bodyClassName="p-4">
                <p className="mb-4 text-meta leading-relaxed text-[color:var(--muted-foreground)]">Se já existir uma conta, o acesso é adicionado imediatamente. Caso contrário, será enviado um convite por email.</p>
                <form onSubmit={invite} className="space-y-3"><Field><FieldLabel htmlFor="workspace-member-email" className={sheetFieldLabelClassName}>Email</FieldLabel><FieldContent><Input id="workspace-member-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@empresa.pt" className={`${sheetEditControlClassName} mt-1.5`} required /></FieldContent></Field><Field><FieldLabel htmlFor="workspace-member-role" className={sheetFieldLabelClassName}>Função</FieldLabel><FieldContent><SheetSelect id="workspace-member-role" name="role" className="mt-1.5" value={role} onValueChange={(value) => setRole(value === "admin" ? "admin" : "member")} options={[{ value: "member", label: "Membro" }, { value: "admin", label: "Administrador" }]} /></FieldContent></Field><Button type="submit" className="w-full" disabled={saving || !email.trim()}><Send className="size-4" />{saving ? "A adicionar…" : "Confirmar acesso"}</Button></form>
              </SheetSection> : null}
              <SheetSection title={`Membros · ${access.members.length}`} bodyClassName="divide-y divide-[color:var(--border)]">
                {access.members.map((member) => <div key={member.id} className="grid grid-cols-[minmax(0,1fr)_160px_auto] items-center gap-2 px-4 py-3"><div className="min-w-0"><p className="truncate text-body font-semibold">{member.label}</p><p className="truncate text-meta text-[color:var(--muted-foreground)]">{member.email || member.profileId}</p></div><SheetSelect name={`member-role-${member.profileId}`} aria-label={`Função de ${member.label}`} value={member.role} onValueChange={(value) => void updateRole(member, value === "admin" ? "admin" : "member")} options={[{ value: "member", label: "Membro" }, { value: "admin", label: "Administrador" }]} /><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover ${member.label}`} onClick={() => void removeMember(member)}><Trash2 className="size-4" /></Button></div>)}
                {access.members.length === 0 ? <EmptyState icon={Users} title="Sem membros" hint="Adicione a primeira pessoa com acesso a esta organização." /> : null}
              </SheetSection>
              <SheetSection title={`Convites pendentes · ${pending.length}`} bodyClassName="divide-y divide-[color:var(--border)]">
                {pending.map((invitation) => <div key={invitation.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-body font-semibold">{invitation.email}</p><div className="mt-1 flex flex-wrap items-center gap-2"><Badge variant="outline"><ShieldCheck className="mr-1 size-3" />{invitation.role === "admin" ? "Administrador" : "Membro"}</Badge><span className="text-meta text-[color:var(--muted-foreground)]">A aguardar resposta</span></div></div><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => void resend(invitation)}>Reenviar</Button><Button type="button" variant="ghost" size="sm" onClick={() => void revoke(invitation)}>Revogar</Button></div></div>)}
                {pending.length === 0 ? <p className="px-4 py-5 text-body text-[color:var(--muted-foreground)]">Não existem convites a aguardar resposta.</p> : null}
              </SheetSection>
            </AppSheetBody>
          )}
        </SheetContent>
      </Sheet>
      <CrmOrganizationSheet open={editOpen} initialMode="edit" organization={organization} onOpenChange={setEditOpen} onSubmit={updateOrganization} />
    </>
  );
}
