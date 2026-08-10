"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Building2, ExternalLink, MailPlus, Pencil, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  StyledSelect,
  SurfaceCard,
} from "@brightweblabs/ui";

import type { CrmContact } from "../data";
import { createCrmUiClient } from "./client";
import { CrmOrganizationSheet, type CrmOrganizationFormInput } from "./organization-sheet";
import type {
  CrmOrganization,
  CrmOrganizationAccess,
  CrmOrganizationInvitation,
  CrmOrganizationMember,
  CrmUiClient,
} from "./types";

type OrganizationPageTab = "overview" | "contacts" | "people";

export type CrmOrganizationPageProps = {
  organizationId: string;
  client?: CrmUiClient;
  backHref?: string;
};

function roleLabel(role: "admin" | "member") {
  return role === "admin" ? "Administrador" : "Membro";
}

function contactName(contact: CrmContact) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Sem nome";
}

export function CrmOrganizationPage({ organizationId, client: providedClient, backHref = "/crm" }: CrmOrganizationPageProps) {
  const client = useMemo(() => providedClient ?? createCrmUiClient(), [providedClient]);
  const [organization, setOrganization] = useState<CrmOrganization | null>(null);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [access, setAccess] = useState<CrmOrganizationAccess>({ members: [], invitations: [] });
  const [activeTab, setActiveTab] = useState<OrganizationPageTab>("people");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [nextOrganization, contactResult, nextAccess] = await Promise.all([
        client.getOrganization(organizationId),
        client.listContacts({ organizationId, page: 1, pageSize: 100, sort: "name" }),
        client.getOrganizationAccess(organizationId, { includeHistory: true }),
      ]);
      setOrganization(nextOrganization);
      setContacts(contactResult.items);
      setAccess(nextAccess);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar a organização.");
    } finally {
      setLoading(false);
    }
  }, [client, organizationId]);

  useEffect(() => { void load(); }, [load]);

  const memberEmails = useMemo(
    () => new Set(access.members.flatMap((member) => member.email ? [member.email.toLowerCase()] : [])),
    [access.members],
  );
  const pendingInvitations = access.invitations.filter((invitation) => invitation.status === "pending");

  const openInvite = (email = "") => {
    setInviteEmail(email);
    setInviteRole("member");
    setInviteOpen(true);
  };

  const submitInvite = async (event: FormEvent) => {
    event.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email || saving) return;
    setSaving(true);
    try {
      await client.inviteOrganizationMember(organizationId, { email, role: inviteRole });
      toast.success(`Acesso preparado para ${email}.`);
      setInviteOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar o membro.");
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (member: CrmOrganizationMember, role: "admin" | "member") => {
    if (member.role === role) return;
    try {
      await client.updateOrganizationMemberRole(organizationId, member.profileId, role);
      setAccess((current) => ({
        ...current,
        members: current.members.map((item) => item.profileId === member.profileId ? { ...item, role } : item),
      }));
      toast.success("Função atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a função.");
    }
  };

  const removeMember = async (member: CrmOrganizationMember) => {
    if (!window.confirm(`Remover o acesso de ${member.label}?`)) return;
    try {
      await client.removeOrganizationMember(organizationId, member.profileId);
      setAccess((current) => ({ ...current, members: current.members.filter((item) => item.profileId !== member.profileId) }));
      toast.success("Acesso removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover o acesso.");
    }
  };

  const revokeInvitation = async (invitation: CrmOrganizationInvitation) => {
    if (!window.confirm(`Revogar o convite de ${invitation.email}?`)) return;
    try {
      await client.revokeOrganizationInvitation(organizationId, invitation.id);
      setAccess((current) => ({
        ...current,
        invitations: current.invitations.map((item) => item.id === invitation.id ? { ...item, status: "revoked" } : item),
      }));
      toast.success("Convite revogado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível revogar o convite.");
    }
  };

  const updateOrganization = async (input: CrmOrganizationFormInput) => {
    try {
      const updated = await client.updateOrganization(organizationId, input);
      setOrganization(updated);
      toast.success("Organização atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a organização.");
      throw error;
    }
  };

  if (loading && !organization) {
    return <div className="mx-auto grid w-full max-w-[1480px] gap-5"><Skeleton className="h-9 w-40" /><Skeleton className="h-44 rounded-[var(--radius-panel)]" /><Skeleton className="h-80 rounded-[var(--radius-panel)]" /></div>;
  }

  if (loadError || !organization) {
    return <SurfaceCard className="mx-auto w-full max-w-[900px] p-8"><EmptyState icon={Building2} title="Organização indisponível" hint={loadError ?? "Não foi possível encontrar esta organização."} /><div className="mt-4 flex justify-center"><Button asChild variant="outline"><a href={backHref}><ArrowLeft className="size-4" />Voltar ao CRM</a></Button></div></SurfaceCard>;
  }

  const tabs: Array<{ id: OrganizationPageTab; label: string; count?: number }> = [
    { id: "overview", label: "Visão geral" },
    { id: "contacts", label: "Contactos", count: contacts.length },
    { id: "people", label: "Membros", count: access.members.length },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 pb-8">
      <a href={backHref} className="inline-flex w-fit items-center gap-2 text-body font-semibold text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"><ArrowLeft className="size-4" />Organizações</a>

      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-[color:var(--hairline)] bg-[color:var(--elevate-1)] shadow-sm">
        <div className="grid gap-6 border-b border-[color:var(--hairline)] p-lg lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div><p className="text-label text-[color:var(--accent)]">Organização CRM</p><h1 className="mt-2 text-hero-sm text-[color:var(--foreground)]">{organization.name}</h1><p className="mt-2 text-body text-[color:var(--muted-foreground)]">{[organization.industry, organization.address].filter(Boolean).join(" · ") || "Perfil da organização"}</p><Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setEditOpen(true)}><Pencil className="size-4" />Editar organização</Button></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[var(--radius-card)] border border-[color:var(--hairline)] bg-[color:var(--elevate-2)] px-4 py-3"><p className="text-data text-title font-semibold">{contacts.length}</p><p className="text-meta text-[color:var(--muted-foreground)]">Contactos CRM</p></div>
            <div className="rounded-[var(--radius-card)] border border-[color:var(--hairline)] bg-[color:var(--elevate-2)] px-4 py-3"><p className="text-data text-title font-semibold">{access.members.length}</p><p className="text-meta text-[color:var(--muted-foreground)]">Membros portal</p></div>
            <div className="rounded-[var(--radius-card)] border border-[color:var(--hairline)] bg-[color:var(--elevate-2)] px-4 py-3"><p className="text-data text-title font-semibold">{pendingInvitations.length}</p><p className="text-meta text-[color:var(--muted-foreground)]">Convites</p></div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4" aria-label="Secções da organização">
          {tabs.map((tab) => <button key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`border-b-2 px-3 py-3 text-body font-semibold transition-colors ${activeTab === tab.id ? "border-[color:var(--accent)] text-[color:var(--foreground)]" : "border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}>{tab.label}{tab.count === undefined ? null : <span className="text-data-sm ml-2 rounded-full bg-[color:var(--elevate-3)] px-2 py-0.5">{tab.count}</span>}</button>)}
        </nav>
      </section>

      {activeTab === "overview" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.7fr)]">
          <SurfaceCard className="p-lg"><h2 className="text-title font-semibold">Perfil da organização</h2><dl className="mt-4 divide-y divide-[color:var(--hairline)] text-body"><div className="flex justify-between gap-4 py-3"><dt className="text-[color:var(--muted-foreground)]">Indústria</dt><dd className="font-semibold">{organization.industry || "Não definido"}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-[color:var(--muted-foreground)]">Dimensão</dt><dd className="font-semibold">{organization.company_size || "Não definido"}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-[color:var(--muted-foreground)]">Morada</dt><dd className="text-right font-semibold">{organization.address || "Não definido"}</dd></div></dl></SurfaceCard>
          <SurfaceCard className="p-lg"><h2 className="text-title font-semibold">Ligação</h2>{organization.website_url ? <a href={organization.website_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-body font-semibold text-[color:var(--accent)]">{organization.website_url}<ExternalLink className="size-4" /></a> : <p className="mt-3 text-body text-[color:var(--muted-foreground)]">Website não definido.</p>}</SurfaceCard>
        </div>
      ) : null}

      {activeTab === "contacts" ? (
        <SurfaceCard className="overflow-hidden"><div className="border-b border-[color:var(--hairline)] p-lg"><h2 className="text-title font-semibold">Contactos CRM</h2><p className="mt-1 text-body text-[color:var(--muted-foreground)]">Contactos comerciais e respetivo acesso ao portal.</p></div><div className="divide-y divide-[color:var(--hairline)]">{contacts.map((contact) => { const hasAccess = Boolean(contact.email && memberEmails.has(contact.email.toLowerCase())); return <div key={contact.id} className="flex flex-col gap-3 px-lg py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-body font-semibold">{contactName(contact)}</p><p className="truncate text-meta text-[color:var(--muted-foreground)]">{contact.email || "Sem e-mail"}</p></div>{hasAccess ? <Badge variant="outline"><ShieldCheck className="mr-1 size-3.5" />Tem acesso</Badge> : <Button type="button" variant="outline" size="sm" disabled={!contact.email} onClick={() => openInvite(contact.email ?? "")}><UserPlus className="size-4" />Dar acesso ao portal</Button>}</div>; })}{contacts.length === 0 ? <EmptyState icon={Users} title="Sem contactos" hint="Ainda não existem contactos CRM nesta organização." /> : null}</div></SurfaceCard>
      ) : null}

      {activeTab === "people" ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.7fr)]">
          <SurfaceCard className="overflow-hidden"><div className="flex items-start justify-between gap-4 border-b border-[color:var(--hairline)] p-lg"><div><h2 className="text-title font-semibold">Membros com acesso</h2><p className="mt-1 text-body text-[color:var(--muted-foreground)]">Contas que podem entrar nesta organização.</p></div><Button type="button" variant="brand" onClick={() => openInvite()}><UserPlus className="size-4" />Adicionar membro</Button></div><div className="border-l-2 border-[color:var(--accent)] bg-[color:var(--elevate-2)] px-4 py-3 text-meta text-[color:var(--muted-foreground)]">Estas alterações afetam apenas <strong className="text-[color:var(--foreground)]">{organization.name}</strong>. A função global não muda.</div><div className="divide-y divide-[color:var(--hairline)]">{access.members.map((member) => <div key={member.id} className="grid gap-3 px-lg py-4 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-center"><div className="min-w-0"><p className="truncate text-body font-semibold">{member.label}</p><p className="truncate text-meta text-[color:var(--muted-foreground)]">{member.email || member.profileId}</p></div><StyledSelect aria-label={`Função de ${member.label}`} value={member.role} onChange={(event) => void updateRole(member, event.target.value === "admin" ? "admin" : "member")} className="h-9 rounded-[var(--radius)] border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-body"><option value="member">Membro</option><option value="admin">Administrador</option></StyledSelect><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover ${member.label}`} onClick={() => void removeMember(member)} className="text-[color:var(--muted-foreground)] hover:text-[color:var(--destructive)]"><Trash2 className="size-4" /></Button></div>)}{access.members.length === 0 ? <EmptyState icon={Users} title="Sem membros" hint="Adicione a primeira pessoa com acesso ao portal." /> : null}</div></SurfaceCard>
          <div className="grid gap-5"><SurfaceCard className="overflow-hidden"><div className="border-b border-[color:var(--hairline)] p-lg"><h2 className="text-title font-semibold">Convites pendentes</h2><p className="mt-1 text-body text-[color:var(--muted-foreground)]">A aguardar registo ou aceitação.</p></div><div className="divide-y divide-[color:var(--hairline)]">{pendingInvitations.map((invitation) => <div key={invitation.id} className="p-4"><p className="break-all text-body font-semibold">{invitation.email}</p><div className="mt-2 flex items-center justify-between gap-3"><Badge variant="outline">{roleLabel(invitation.role)}</Badge><Button type="button" variant="ghost" size="sm" onClick={() => void revokeInvitation(invitation)} className="text-[color:var(--destructive)]">Revogar</Button></div></div>)}{pendingInvitations.length === 0 ? <p className="p-lg text-body text-[color:var(--muted-foreground)]">Sem convites pendentes.</p> : null}</div></SurfaceCard><SurfaceCard className="p-lg"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-[color:var(--accent)]" /><h2 className="text-body font-semibold">Regra de segurança</h2></div><p className="mt-2 text-meta leading-relaxed text-[color:var(--muted-foreground)]">A organização deve manter pelo menos um Administrador.</p></SurfaceCard></div>
        </div>
      ) : null}

      <CrmOrganizationSheet open={editOpen} initialMode="edit" organization={organization} onOpenChange={setEditOpen} onSubmit={updateOrganization} />
      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}><SheetContent className="h-screen w-full gap-0 border-l border-[color:var(--hairline)] bg-[color:var(--background)] sm:max-w-[500px]"><SheetHeader className="border-b border-[color:var(--hairline)] p-lg"><div className="mb-2 flex size-9 items-center justify-center rounded-full bg-[color:var(--elevate-3)]"><MailPlus className="size-4" /></div><SheetTitle>Adicionar membro</SheetTitle><SheetDescription>Associe um contacto CRM existente ou envie um convite para {organization.name}.</SheetDescription></SheetHeader><form onSubmit={submitInvite} className="flex flex-1 flex-col gap-5 p-lg"><label className="grid gap-2 text-label">E-mail<Input id="organization-member-email" name="email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="nome@empresa.pt" required autoComplete="email" /></label><label className="grid gap-2 text-label">Função na organização<StyledSelect id="organization-member-role" name="role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value === "admin" ? "admin" : "member")} className="h-11 rounded-[var(--radius)] border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-body"><option value="member">Membro</option><option value="admin">Administrador</option></StyledSelect></label><div className="rounded-[var(--radius-card)] border border-[color:var(--hairline)] bg-[color:var(--elevate-2)] p-4 text-meta leading-relaxed text-[color:var(--muted-foreground)]"><strong className="text-[color:var(--foreground)]">Sem duplicar contactos.</strong> Se o e-mail já existir no CRM, o acesso fica ligado à mesma pessoa.</div><div className="mt-auto flex gap-3"><Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button><Button type="submit" variant="brand" disabled={saving || !inviteEmail.trim()} className="flex-1">{saving ? "A adicionar…" : "Adicionar ou convidar"}</Button></div></form></SheetContent></Sheet>
    </div>
  );
}
