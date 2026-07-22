"use client";

import { useProjectsUiClient } from "./context";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Save, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  sheetBodyClassName,
  sheetFooterClassName,
  sheetShellClassName,
} from "./constants";
import { AppSheetHeader } from "./shared/app-sheet";
import { SearchField } from "@brightweblabs/ui";
import { Button } from "@brightweblabs/ui";
import { SectionIconButton } from "./shared/section-icon-button";
import { Skeleton } from "@brightweblabs/ui";
import {
  Sheet,
  SheetContent,
  SheetFooter,
} from "@brightweblabs/ui";
import { TooltipProvider } from "@brightweblabs/ui";
import { PROJECT_MEMBER_ROLE_LABELS_PT, type ProjectMemberRole } from "../contracts";

type ProjectMemberOption = {
  profileId: string;
  label: string;
  email: string | null;
  organizationRole: "staff" | "admin" | "org_admin" | "org_member";
  projectRole: ProjectMemberRole | null;
};

const PROJECT_MEMBER_SCOPE_LABELS: Record<ProjectMemberOption["organizationRole"], string> = {
  admin: "BeGreen admin",
  staff: "BeGreen staff",
  org_admin: "Cliente · admin",
  org_member: "Cliente",
};

const MAX_ADD_RESULTS = 25;

// Internos (equipa BeGreen) podem ser Gestor, Colaborador ou Observador.
// Clientes são sempre Observador — nunca mexem no projeto.
function isInternalIdentity(role: ProjectMemberOption["organizationRole"]): boolean {
  return role === "staff" || role === "admin";
}

// Internos entram como Colaborador; clientes como Observador (papel fixo).
function defaultRoleFor(member: ProjectMemberOption): ProjectMemberRole {
  return isInternalIdentity(member.organizationRole) ? "contributor" : "observer";
}

function MemberIdentity({ member }: { member: ProjectMemberOption }) {
  return (
    <div className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold text-foreground">{member.label}</span>
      <span className="block truncate text-xs text-foreground/60">
        {member.email ?? "Sem email"} · {PROJECT_MEMBER_SCOPE_LABELS[member.organizationRole]}
      </span>
    </div>
  );
}

type TeamMemberRowProps = {
  member: ProjectMemberOption;
  role: ProjectMemberRole;
  onRoleChange: (role: ProjectMemberRole) => void;
  onRemove: () => void;
};

function TeamMemberRow({ member, role, onRoleChange, onRemove }: TeamMemberRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-black/8 bg-background/70 px-3 py-2 dark:border-white/10">
      <MemberIdentity member={member} />
      {isInternalIdentity(member.organizationRole) ? (
        <select
          className="h-7 rounded-md border border-black/10 bg-background px-2 text-xs dark:border-white/10"
          value={role}
          onChange={(event) => onRoleChange(event.target.value as ProjectMemberRole)}
        >
          <option value="owner">{PROJECT_MEMBER_ROLE_LABELS_PT.owner}</option>
          <option value="contributor">{PROJECT_MEMBER_ROLE_LABELS_PT.contributor}</option>
          <option value="observer">{PROJECT_MEMBER_ROLE_LABELS_PT.observer}</option>
        </select>
      ) : (
        // Cliente: papel fixo em Observador, sem opção de alterar.
        <span className="inline-flex h-7 items-center rounded-md border border-black/8 bg-background/60 px-2 text-xs text-foreground/60 dark:border-white/10">
          {PROJECT_MEMBER_ROLE_LABELS_PT.observer}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-foreground/50 hover:text-foreground"
        onClick={onRemove}
      >
        <X className="size-4" />
        <span className="sr-only">Remover do projeto</span>
      </Button>
    </div>
  );
}

function AddResultRow({ member, onAdd }: { member: ProjectMemberOption; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-black/8 bg-background/40 px-3 py-2 dark:border-white/10">
      <MemberIdentity member={member} />
      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onAdd}>
        <Plus className="mr-1 size-3.5" />
        {PROJECT_MEMBER_ROLE_LABELS_PT[defaultRoleFor(member)]}
      </Button>
    </div>
  );
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-2 px-0.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">{title}</span>
      {typeof count === "number" ? <span className="text-[0.7rem] text-foreground/45">{count}</span> : null}
    </div>
  );
}

type ProjectMembersEditSheetProps = {
  projectId: string;
  initialMembers: Array<{ profileId: string; role: ProjectMemberRole }>;
};

export function ProjectMembersEditSheet({
  projectId, initialMembers }: ProjectMembersEditSheetProps) {
  const client = useProjectsUiClient();
  const router = useRouter();
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberOptions, setMemberOptions] = useState<ProjectMemberOption[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Record<string, ProjectMemberRole>>(() => (
    initialMembers.reduce<Record<string, ProjectMemberRole>>((acc, member) => {
      acc[member.profileId] = member.role;
      return acc;
    }, {})
  ));

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  useEffect(() => {
    if (open) return;
    setMemberSearch("");
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const controller = new AbortController();

    const loadMembers = async () => {
      setIsLoading(true);
      try {
        const response = await client.requestRaw(`/api/projects/${projectId}/members`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Não foi possível carregar opções da equipa.";
          throw new Error(message);
        }

        const options = (Array.isArray(payload?.data) ? payload.data : []) as ProjectMemberOption[];
        if (!isMounted) return;

        setMemberOptions(options);
        setSelectedMembers(() => {
          const fromApi = options.reduce<Record<string, ProjectMemberRole>>((acc, option) => {
            if (option.projectRole) acc[option.profileId] = option.projectRole;
            return acc;
          }, {});
          if (Object.keys(fromApi).length > 0) return fromApi;
          return initialMembers.reduce<Record<string, ProjectMemberRole>>((acc, member) => {
            acc[member.profileId] = member.role;
            return acc;
          }, {});
        });
      } catch (error) {
        if (!isMounted) return;
        toast.error(error instanceof Error ? error.message : "Erro ao carregar equipa.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadMembers();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [initialMembers, open, projectId]);

  const optionsByProfile = useMemo(() => {
    return new Map(memberOptions.map((option) => [option.profileId, option]));
  }, [memberOptions]);

  // A equipa já alocada — sempre visível, internos primeiro, depois por nome.
  const teamMembers = useMemo(() => {
    return Object.keys(selectedMembers)
      .map((profileId) => optionsByProfile.get(profileId))
      .filter((option): option is ProjectMemberOption => Boolean(option))
      .sort((a, b) => {
        const internalDelta = Number(isInternalIdentity(b.organizationRole)) - Number(isInternalIdentity(a.organizationRole));
        if (internalDelta !== 0) return internalDelta;
        return a.label.localeCompare(b.label, "pt");
      });
  }, [optionsByProfile, selectedMembers]);

  // Resultados para adicionar — só aparecem com pesquisa, nunca uma lista despejada.
  const addResults = useMemo(() => {
    const needle = memberSearch.trim().toLowerCase();
    if (!needle) return [];
    return memberOptions
      .filter((member) => !selectedMembers[member.profileId])
      .filter((member) => (
        member.label.toLowerCase().includes(needle)
        || (member.email ?? "").toLowerCase().includes(needle)
      ))
      .sort((a, b) => {
        const internalDelta = Number(isInternalIdentity(b.organizationRole)) - Number(isInternalIdentity(a.organizationRole));
        if (internalDelta !== 0) return internalDelta;
        return a.label.localeCompare(b.label, "pt");
      });
  }, [memberOptions, memberSearch, selectedMembers]);

  const addMember = (member: ProjectMemberOption) => {
    setSelectedMembers((current) => ({ ...current, [member.profileId]: defaultRoleFor(member) }));
  };

  const removeMember = (profileId: string) => {
    setSelectedMembers((current) => {
      const next = { ...current };
      delete next[profileId];
      return next;
    });
  };

  const setMemberRole = (profileId: string, role: ProjectMemberRole) => {
    setSelectedMembers((current) => {
      const next = { ...current };
      if (role === "owner") {
        for (const [id, assignedRole] of Object.entries(next)) {
          if (id !== profileId && assignedRole === "owner") {
            next[id] = "contributor";
          }
        }
      }
      next[profileId] = role;
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    const membersPayload = Object.entries(selectedMembers).map(([profileId, role]) => ({ profileId, role }));
    setIsSaving(true);
    try {
      const response = await client.requestRaw(`/api/projects/${projectId}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: membersPayload }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Não foi possível guardar a equipa.";
        throw new Error(message);
      }

      toast.success("Equipa atualizada.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao guardar equipa.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isClientMounted) {
    return (
      <TooltipProvider>
        <SectionIconButton icon={Pencil} label="Editar equipa" disabled />
      </TooltipProvider>
    );
  }

  const needle = memberSearch.trim();

  return (
    <TooltipProvider>
      <Sheet open={open} onOpenChange={setOpen}>
        <SectionIconButton icon={Pencil} label="Editar equipa" onClick={() => setOpen(true)} />
        <SheetContent className={sheetShellClassName}>
        <AppSheetHeader
          icon={Users}
          editing
          eyebrow="A editar"
          title={<>Equipa alocada</>}
          description={<>Equipa interna assume qualquer papel; clientes entram como observadores.</>}
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={`${sheetBodyClassName} space-y-5`}>
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-black/8 px-3 py-2 dark:border-white/10">
                    <Skeleton rounded="999px" className="h-[0.6rem] w-[40%]" />
                    <Skeleton rounded="999px" className="ml-auto h-5 w-16 shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Equipa já no projeto */}
                <section className="space-y-2">
                  <SectionHeading title="Equipa neste projeto" count={teamMembers.length} />
                  {teamMembers.length === 0 ? (
                    <p className="text-xs text-foreground/60">Ainda ninguém alocado. Pesquisa abaixo para adicionar.</p>
                  ) : (
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <TeamMemberRow
                          key={member.profileId}
                          member={member}
                          role={selectedMembers[member.profileId]}
                          onRoleChange={(role) => setMemberRole(member.profileId, role)}
                          onRemove={() => removeMember(member.profileId)}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Adicionar pessoas — sempre por pesquisa */}
                <section className="space-y-2">
                  <SectionHeading title="Adicionar pessoas" />
                  <SearchField
                    size="sm"
                    value={memberSearch}
                    onChange={setMemberSearch}
                    onClear={() => setMemberSearch("")}
                    placeholder="Pesquisar equipa interna ou clientes por nome ou email"
                  />
                  {needle === "" ? (
                    <p className="text-xs text-foreground/55">Escreve um nome ou email para encontrar pessoas a adicionar.</p>
                  ) : addResults.length === 0 ? (
                    <p className="text-xs text-foreground/55">Sem resultados para “{needle}”.</p>
                  ) : (
                    <div className="space-y-2">
                      {addResults.slice(0, MAX_ADD_RESULTS).map((member) => (
                        <AddResultRow key={member.profileId} member={member} onAdd={() => addMember(member)} />
                      ))}
                      {addResults.length > MAX_ADD_RESULTS ? (
                        <p className="text-xs text-foreground/55">
                          A mostrar {MAX_ADD_RESULTS} de {addResults.length}. Refina a pesquisa.
                        </p>
                      ) : null}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
            <Button type="submit" className="flex-1" disabled={isSaving || isLoading}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "A guardar..." : "Guardar equipa"}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
          </SheetFooter>
        </form>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
