"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@brightweblabs/ui/alert-dialog";
import { Badge } from "@brightweblabs/ui/badge";
import { Button } from "@brightweblabs/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@brightweblabs/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@brightweblabs/ui/table";
import {
  ADMIN_EVENTS,
  dispatchAdminCustomEvent,
  dispatchAdminEvent,
  type AdminSetBulkRoleEventDetail,
  type AdminSetRoleFilterEventDetail,
  type AdminSetSearchEventDetail,
} from "./events";
import type { AdminManagedRole, AdminUsersListResult, AdminUserRow } from "./users";

type UsersResponse = AdminUsersListResult;

type PendingRoleAction = {
  profileIds: string[];
  newRole: AdminManagedRole;
  mode: "single" | "bulk";
};

const ROLE_OPTIONS: Array<{ value: AdminManagedRole; label: string }> = [
  { value: "client", label: "Cliente" },
  { value: "staff", label: "Colaborador" },
  { value: "admin", label: "Administrador" },
];

const roleLabelByValue = new Map(ROLE_OPTIONS.map((role) => [role.value, role.label]));
const rolePalette: Record<AdminManagedRole, string> = {
  client: "border-slate-300/70 bg-slate-50/85 text-slate-900 dark:border-slate-500/35 dark:bg-slate-500/14 dark:text-slate-100",
  staff: "border-amber-300/70 bg-amber-50/85 text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/14 dark:text-amber-100",
  admin: "border-rose-300/70 bg-rose-50/85 text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/14 dark:text-rose-100",
};

type AdminUsersClientProps = {
  initialUsers: AdminUsersListResult;
};

function formatAdminDate(value: string | null, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getBulkRoleSelectionSummary(
  rows: AdminUserRow[],
  selectedIds: string[],
  bulkTargetRole: AdminManagedRole,
) {
  const selectedIdSet = new Set(selectedIds);
  const profileIdsToChange: string[] = [];
  let unchangedCount = 0;

  for (const row of rows) {
    if (!selectedIdSet.has(row.profileId)) {
      continue;
    }

    if (row.role === bulkTargetRole) {
      unchangedCount += 1;
      continue;
    }

    profileIdsToChange.push(row.profileId);
  }

  return { profileIdsToChange, unchangedCount };
}

export function AdminUsersClient({ initialUsers }: AdminUsersClientProps) {
  const [rows, setRows] = useState<AdminUserRow[]>(initialUsers.data);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AdminManagedRole>("all");
  const [page, setPage] = useState(initialUsers.pagination.page);
  const [pageSize] = useState(initialUsers.pagination.pageSize);
  const [total, setTotal] = useState(initialUsers.pagination.total);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTargetRole, setBulkTargetRole] = useState<AdminManagedRole>("staff");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRoleAction, setPendingRoleAction] = useState<PendingRoleAction | null>(null);
  const [reason, setReason] = useState("");
  const didRunInitialFetchRef = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadUsers = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      if (debouncedSearch) params.set("search", debouncedSearch);
      if (roleFilter !== "all") params.set("role", roleFilter);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const payload = (await response.json()) as UsersResponse | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Não foi possível carregar utilizadores admin");
      }

      setRows(payload.data);
      setTotal(payload.pagination.total);
      setSelectedIds((current) => current.filter((id) => payload.data.some((row) => row.profileId === id)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar utilizadores");
      setRows([]);
      setTotal(0);
      setSelectedIds([]);
    } finally {
      setLoading(false);
      dispatchAdminEvent(ADMIN_EVENTS.refreshComplete);
    }
  }, [debouncedSearch, page, pageSize, roleFilter]);

  useEffect(() => {
    if (!didRunInitialFetchRef.current) {
      didRunInitialFetchRef.current = true;
      return;
    }

    void loadUsers();
  }, [loadUsers]);

  const handleSetSearch = useEffectEvent((event: Event) => {
    const customEvent = event as CustomEvent<AdminSetSearchEventDetail>;
    setSearch(customEvent.detail?.query ?? "");
  });

  const handleSetRoleFilter = useEffectEvent((event: Event) => {
    const customEvent = event as CustomEvent<AdminSetRoleFilterEventDetail>;
    setRoleFilter(customEvent.detail?.role ?? "all");
    setPage(1);
  });

  const handleSetBulkRole = useEffectEvent((event: Event) => {
    const customEvent = event as CustomEvent<AdminSetBulkRoleEventDetail>;
    if (customEvent.detail?.role) {
      setBulkTargetRole(customEvent.detail.role);
    }
  });

  const handleApplyBulk = useEffectEvent(() => {
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos um utilizador.");
      return;
    }

    const { profileIdsToChange, unchangedCount } = getBulkRoleSelectionSummary(rows, selectedIds, bulkTargetRole);

    if (profileIdsToChange.length === 0) {
      const targetRoleLabel = roleLabelByValue.get(bulkTargetRole) ?? bulkTargetRole;
      toast.error(`Os utilizadores selecionados já têm a função ${targetRoleLabel}.`);
      return;
    }

    if (unchangedCount > 0) {
      toast.error(
        `${unchangedCount} utilizador${unchangedCount > 1 ? "es" : ""} já tinha${unchangedCount > 1 ? "m" : ""} esta função e será ignorado.`,
      );
    }

    setPendingRoleAction({
      profileIds: profileIdsToChange,
      newRole: bulkTargetRole,
      mode: "bulk",
    });
    setReason("");
  });

  const handleRefresh = useEffectEvent(() => {
    void loadUsers();
  });

  useEffect(() => {
    const onSetSearch = (event: Event) => handleSetSearch(event);
    const onSetRoleFilter = (event: Event) => handleSetRoleFilter(event);
    const onSetBulkRole = (event: Event) => handleSetBulkRole(event);
    const onApplyBulk = () => handleApplyBulk();
    const onRefresh = () => handleRefresh();

    window.addEventListener(ADMIN_EVENTS.setSearch, onSetSearch as EventListener);
    window.addEventListener(ADMIN_EVENTS.setRoleFilter, onSetRoleFilter as EventListener);
    window.addEventListener(ADMIN_EVENTS.setBulkRole, onSetBulkRole as EventListener);
    window.addEventListener(ADMIN_EVENTS.applyBulk, onApplyBulk);
    window.addEventListener(ADMIN_EVENTS.refresh, onRefresh);

    return () => {
      window.removeEventListener(ADMIN_EVENTS.setSearch, onSetSearch as EventListener);
      window.removeEventListener(ADMIN_EVENTS.setRoleFilter, onSetRoleFilter as EventListener);
      window.removeEventListener(ADMIN_EVENTS.setBulkRole, onSetBulkRole as EventListener);
      window.removeEventListener(ADMIN_EVENTS.applyBulk, onApplyBulk);
      window.removeEventListener(ADMIN_EVENTS.refresh, onRefresh);
    };
  }, []);

  useEffect(() => {
    dispatchAdminCustomEvent(ADMIN_EVENTS.state, {
      roleFilter,
      search,
      selectedCount: selectedIds.length,
      bulkRole: bulkTargetRole,
      isApplyingBulk: isSubmitting,
    });
  }, [bulkTargetRole, isSubmitting, roleFilter, search, selectedIds.length]);

  const allOnPageSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.profileId));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleSelection = (profileId: string) => {
    setSelectedIds((current) =>
      current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId],
    );
  };

  const setAllPageSelection = (checked: boolean) => {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...rows.map((row) => row.profileId)])));
      return;
    }

    setSelectedIds((current) => current.filter((id) => !rows.some((row) => row.profileId === id)));
  };

  const requestRoleChange = (profileIds: string[], newRole: AdminManagedRole, mode: "single" | "bulk") => {
    if (profileIds.length === 0) return;
    setPendingRoleAction({ profileIds, newRole, mode });
    setReason("");
  };

  const submitRoleChange = async () => {
    if (!pendingRoleAction) return;
    if (pendingRoleAction.profileIds.length === 0) {
      toast.error("Não existem alterações para aplicar.");
      return;
    }

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      toast.error("O motivo é obrigatório.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/users/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileIds: pendingRoleAction.profileIds,
          newRole: pendingRoleAction.newRole,
          reason: normalizedReason,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível atualizar funções");
      }

      const changed = Number(payload?.summary?.changed ?? 0);
      const skipped = Number(payload?.summary?.skipped ?? 0);

      if (changed > 0) {
        toast.success(`Função atualizada para ${changed} utilizador${changed > 1 ? "es" : ""}.`);
      }
      if (skipped > 0) {
        toast.error(`${skipped} utilizador${skipped > 1 ? "es" : ""} ignorado${skipped > 1 ? "s" : ""}. Verifique as salvaguardas.`);
      }

      setPendingRoleAction(null);
      setReason("");
      setSelectedIds([]);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar funções");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingLabel = pendingRoleAction ? roleLabelByValue.get(pendingRoleAction.newRole) ?? pendingRoleAction.newRole : "";

  return (
    <div className="mx-auto flex w-full max-w-[1260px] flex-col gap-6">
      <section className="dashboard-reveal rounded-3xl border border-black/10 bg-white/60 p-5 backdrop-blur-xl dark:border-white/15 dark:bg-black/30 md:p-6">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
            <Users className="size-3.5" />
            Painel de Administração
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-foreground md:text-3xl">Tabela de Utilizadores</h1>
          <p className="mt-2 text-sm text-foreground/75">Gerir funções globais dos utilizadores da plataforma.</p>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-foreground/75">
            {total} utilizador{total === 1 ? "" : "es"} encontrado{total === 1 ? "" : "s"}.
          </p>
          {loading ? <p className="text-xs text-foreground/60">A atualizar...</p> : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white px-2 py-2 shadow-[0_10px_28px_rgba(8,24,16,0.08)] dark:border-white/10 dark:bg-black/35">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="heading-6 w-12 px-2">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={(event) => setAllPageSelection(event.target.checked)}
                    className="h-4 w-4 rounded border border-foreground/30"
                    aria-label="Selecionar todos os utilizadores da página"
                  />
                </TableHead>
                <TableHead className="heading-6">Nome</TableHead>
                <TableHead className="heading-6">Email</TableHead>
                <TableHead className="heading-6">Função</TableHead>
                <TableHead className="heading-6">Criado</TableHead>
                <TableHead className="heading-6">Atualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-foreground/65">
                    A carregar utilizadores...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-foreground/65">
                    Nenhum utilizador corresponde aos filtros.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.profileId} className="hover:bg-black/3 dark:hover:bg-white/5">
                    <TableCell className="px-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.profileId)}
                        onChange={() => toggleSelection(row.profileId)}
                        className="h-4 w-4 rounded border border-foreground/30"
                        aria-label={`Selecionar ${row.email}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                    <TableCell className="text-foreground/80">{row.email}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            id={`admin-user-role-trigger-${row.profileId}`}
                            className="inline-flex items-center rounded-full"
                            aria-label={`Alterar função de ${row.email}`}
                          >
                            <Badge className={rolePalette[row.role]}>{roleLabelByValue.get(row.role) ?? row.role}</Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="min-w-44 rounded-xl border-black/12 bg-white/95 p-1.5 dark:border-white/12 dark:bg-black/75"
                        >
                          {ROLE_OPTIONS.filter((roleOption) => roleOption.value !== row.role).map((roleOption) => (
                            <DropdownMenuItem
                              key={roleOption.value}
                              onClick={() => {
                                if (roleOption.value === row.role) return;
                                requestRoleChange([row.profileId], roleOption.value, "single");
                              }}
                              className="my-0.5 rounded-full"
                            >
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 paragraph-mini font-semibold ${rolePalette[roleOption.value]}`}
                              >
                                {roleOption.label}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="text-foreground/75">{formatAdminDate(row.createdAt)}</TableCell>
                    <TableCell className="text-foreground/75">{formatAdminDate(row.updatedAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-foreground/65">
            Página {page} de {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Seguinte
            </Button>
          </div>
        </div>
      </section>

      <AlertDialog
        open={pendingRoleAction !== null}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            setPendingRoleAction(null);
            setReason("");
          }
        }}
      >
        <AlertDialogContent className="max-w-[460px]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRoleAction?.mode === "bulk" ? "Confirmar alteração em massa" : "Confirmar alteração de função"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRoleAction?.mode === "bulk"
                ? `Aplicar a função ${pendingLabel} a ${pendingRoleAction.profileIds.length} utilizadores selecionados.`
                : `Aplicar a função ${pendingLabel} ao utilizador selecionado.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label htmlFor="admin-role-reason" className="paragraph-mini text-foreground/60">
              Motivo (obrigatório)
            </label>
            <textarea
              id="admin-role-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Porque está a alterar esta função?"
              className="min-h-[110px] w-full rounded-xl border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm text-foreground"
              disabled={isSubmitting}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full border-black/10 px-4 text-xs dark:border-white/15" disabled={isSubmitting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-emerald-600 px-4 text-xs text-white hover:bg-emerald-700"
              onClick={(event) => {
                event.preventDefault();
                void submitRoleChange();
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "A aplicar" : "Confirmar alterações"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
