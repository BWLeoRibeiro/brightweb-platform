"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { motion } from "motion/react";
import { Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Checkbox, DropdownMenu,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, Table, TableBody, TableCell,
  TableHead, TableHeader, TablePagination, TableRow, TableRowsSkeleton,
} from "@brightweblabs/ui";
import {
  ADMIN_EVENTS, dispatchAdminCustomEvent, dispatchAdminEvent, type AdminSetBulkRoleEventDetail,
  type AdminSetRoleFilterEventDetail, type AdminSetSearchEventDetail,
} from "../events";
import type { AdminManagedRole, AdminUserRow, AdminUsersListResult } from "../users";
import { createAdminUiClient } from "./client";
import { defaultAdminUiDictionary } from "./dictionary";
import { AdminRolePill } from "./role-pill";
import type { AdminInviteRole, AdminUiClient, AdminUiDictionary, AdminUserInvitation, AdminUsersView } from "./types";

type PendingRoleAction = { profileIds: string[]; newRole: AdminManagedRole; mode: "single" | "bulk" };
const roleValues: AdminManagedRole[] = ["client", "staff", "admin"];
const inviteRoleValues: AdminInviteRole[] = ["staff", "admin"];
const defaultAdminUiClient = createAdminUiClient();

function resolveAdminUsersPageSize(fallback: number) {
  if (typeof window === "undefined") return fallback;
  if (window.innerWidth >= 1800 && window.innerHeight >= 1050) return 20;
  if (window.innerWidth > 1440 && window.innerHeight > 900) return 15;
  return fallback;
}

function formatAdminDate(value: string | null, locale: string, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function getBulkRoleSelectionSummary(rows: AdminUserRow[], selectedIds: string[], bulkTargetRole: AdminManagedRole) {
  const selectedIdSet = new Set(selectedIds);
  const profileIdsToChange: string[] = [];
  let unchangedCount = 0;
  for (const row of rows) {
    if (!selectedIdSet.has(row.profileId)) continue;
    if (row.role === bulkTargetRole) unchangedCount += 1;
    else profileIdsToChange.push(row.profileId);
  }
  return { profileIdsToChange, unchangedCount };
}

export type AdminUsersClientProps = {
  initialUsers: AdminUsersListResult;
  client?: AdminUiClient;
  dictionary?: AdminUiDictionary;
};

export function AdminUsersClient({
  initialUsers,
  client = defaultAdminUiClient,
  dictionary = defaultAdminUiDictionary,
}: AdminUsersClientProps) {
  const [rows, setRows] = useState<AdminUserRow[]>(initialUsers.data);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AdminManagedRole>("all");
  const [page, setPage] = useState(initialUsers.pagination.page);
  const [pageSize, setPageSize] = useState(() => resolveAdminUsersPageSize(initialUsers.pagination.pageSize));
  const [total, setTotal] = useState(initialUsers.pagination.total);
  const [activeView, setActiveView] = useState<AdminUsersView>("users");
  const [hoveredView, setHoveredView] = useState<AdminUsersView | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTargetRole, setBulkTargetRole] = useState<AdminManagedRole>("staff");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRoleAction, setPendingRoleAction] = useState<PendingRoleAction | null>(null);
  const [reason, setReason] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminInviteRole>("staff");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<AdminUserInvitation[]>([]);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const didRunInitialFetchRef = useRef(false);
  const didLoadInvitationsRef = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 180);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await client.listUsers({
        page, pageSize, search: debouncedSearch || undefined, role: roleFilter === "all" ? null : roleFilter,
      });
      setRows(payload.data);
      setTotal(payload.pagination.total);
      setSelectedIds((current) => current.filter((id) => payload.data.some((row) => row.profileId === id)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.users.loadError);
      setRows([]);
      setTotal(0);
      setSelectedIds([]);
    } finally {
      setLoading(false);
      dispatchAdminEvent(ADMIN_EVENTS.refreshComplete);
    }
  }, [client, debouncedSearch, dictionary.users.loadError, page, pageSize, roleFilter]);

  const loadInvitations = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (didLoadInvitationsRef.current && !force) return;
    didLoadInvitationsRef.current = true;
    setInviteLoading(true);
    try {
      const invitations = await client.listInvitations();
      setPendingInvites(invitations.filter((invite) => invite.status === "pending"));
    } catch (error) {
      didLoadInvitationsRef.current = false;
      toast.error(error instanceof Error ? error.message : dictionary.invitations.loadError);
      setPendingInvites([]);
    } finally {
      setInviteLoading(false);
    }
  }, [client, dictionary.invitations.loadError]);

  useEffect(() => {
    const handleResize = () => setPageSize((current) => {
      const next = resolveAdminUsersPageSize(initialUsers.pagination.pageSize);
      return current === next ? current : next;
    });
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initialUsers.pagination.pageSize]);

  useEffect(() => {
    if (!didRunInitialFetchRef.current) { didRunInitialFetchRef.current = true; return; }
    void loadUsers();
  }, [loadUsers]);
  useEffect(() => { void loadInvitations(); }, [loadInvitations]);

  const handleSetSearch = useEffectEvent((event: Event) => setSearch((event as CustomEvent<AdminSetSearchEventDetail>).detail?.query ?? ""));
  const handleSetRoleFilter = useEffectEvent((event: Event) => {
    setRoleFilter((event as CustomEvent<AdminSetRoleFilterEventDetail>).detail?.role ?? "all");
    setPage(1);
  });
  const handleSetBulkRole = useEffectEvent((event: Event) => {
    const role = (event as CustomEvent<AdminSetBulkRoleEventDetail>).detail?.role;
    if (role) setBulkTargetRole(role);
  });
  const handleApplyBulk = useEffectEvent(() => {
    if (selectedIds.length === 0) { toast.error(dictionary.roleChange.selectRequired); return; }
    const { profileIdsToChange, unchangedCount } = getBulkRoleSelectionSummary(rows, selectedIds, bulkTargetRole);
    if (profileIdsToChange.length === 0) {
      toast.error(dictionary.roleChange.alreadyAssigned(dictionary.roles[bulkTargetRole]));
      return;
    }
    if (unchangedCount > 0) toast.error(dictionary.roleChange.unchanged(unchangedCount));
    setPendingRoleAction({ profileIds: profileIdsToChange, newRole: bulkTargetRole, mode: "bulk" });
    setReason("");
  });
  const handleRefresh = useEffectEvent(() => {
    void loadUsers();
    if (activeView === "invites") void loadInvitations({ force: true });
  });

  useEffect(() => {
    const onSetSearch = (event: Event) => handleSetSearch(event);
    const onSetRoleFilter = (event: Event) => handleSetRoleFilter(event);
    const onSetBulkRole = (event: Event) => handleSetBulkRole(event);
    const onApplyBulk = () => handleApplyBulk();
    const onRefresh = () => handleRefresh();
    window.addEventListener(ADMIN_EVENTS.setSearch, onSetSearch);
    window.addEventListener(ADMIN_EVENTS.setRoleFilter, onSetRoleFilter);
    window.addEventListener(ADMIN_EVENTS.setBulkRole, onSetBulkRole);
    window.addEventListener(ADMIN_EVENTS.applyBulk, onApplyBulk);
    window.addEventListener(ADMIN_EVENTS.refresh, onRefresh);
    return () => {
      window.removeEventListener(ADMIN_EVENTS.setSearch, onSetSearch);
      window.removeEventListener(ADMIN_EVENTS.setRoleFilter, onSetRoleFilter);
      window.removeEventListener(ADMIN_EVENTS.setBulkRole, onSetBulkRole);
      window.removeEventListener(ADMIN_EVENTS.applyBulk, onApplyBulk);
      window.removeEventListener(ADMIN_EVENTS.refresh, onRefresh);
    };
  }, []);

  useEffect(() => {
    dispatchAdminCustomEvent(ADMIN_EVENTS.state, {
      roleFilter, search, selectedCount: selectedIds.length, bulkRole: bulkTargetRole, isApplyingBulk: isSubmitting,
    });
  }, [bulkTargetRole, isSubmitting, roleFilter, search, selectedIds.length]);

  const allOnPageSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.profileId));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const setAllPageSelection = (checked: boolean) => setSelectedIds((current) => checked
    ? Array.from(new Set([...current, ...rows.map((row) => row.profileId)]))
    : current.filter((id) => !rows.some((row) => row.profileId === id)));

  const submitInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) { toast.error(dictionary.invitations.emailRequired); return; }
    setInviteSubmitting(true);
    try {
      await client.inviteUser({ email, role: inviteRole });
      toast.success(dictionary.invitations.sent);
      setInviteEmail("");
      setInviteRole("staff");
      await loadInvitations({ force: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.invitations.sendError);
    } finally {
      setInviteSubmitting(false);
    }
  };

  const revokeInvite = async (invitationId: string) => {
    setRevokingInviteId(invitationId);
    try {
      await client.revokeInvitation(invitationId);
      toast.success(dictionary.invitations.revoked);
      await loadInvitations({ force: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.invitations.revokeError);
    } finally {
      setRevokingInviteId(null);
    }
  };

  const submitRoleChange = async () => {
    if (!pendingRoleAction) return;
    if (pendingRoleAction.profileIds.length === 0) { toast.error(dictionary.roleChange.noChanges); return; }
    const normalizedReason = reason.trim();
    if (!normalizedReason) { toast.error(dictionary.roleChange.reasonRequired); return; }
    setIsSubmitting(true);
    try {
      const summary = await client.changeRoles({
        profileIds: pendingRoleAction.profileIds, newRole: pendingRoleAction.newRole, reason: normalizedReason,
      });
      if (summary.changed > 0) toast.success(dictionary.roleChange.changed(summary.changed));
      if (summary.skipped > 0) toast.error(dictionary.roleChange.skipped(summary.skipped));
      setPendingRoleAction(null);
      setReason("");
      setSelectedIds([]);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.roleChange.updateError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingLabel = pendingRoleAction ? dictionary.roles[pendingRoleAction.newRole] : "";
  const views = [
    { id: "users" as const, label: dictionary.views.users, count: total },
    { id: "invites" as const, label: dictionary.views.invites, count: pendingInvites.length },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 pb-6 pt-0 md:pb-8">
      <section className="admin-dashboard-reveal">
        <div className="inline-flex w-fit items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] p-1" onMouseLeave={() => setHoveredView(null)}>
          {views.map((view) => {
            const isActive = activeView === view.id;
            const isHovered = hoveredView === view.id && !isActive;
            return (
              <motion.button key={view.id} type="button" onClick={() => setActiveView(view.id)} onMouseEnter={() => setHoveredView(view.id)} onFocus={() => setHoveredView(view.id)} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} className={`relative inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold outline-none transition-colors duration-200 ${isActive ? "text-[color:var(--accent-foreground)]" : isHovered ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>
                {isHovered ? <motion.span layoutId="admin-users-tab-hover" aria-hidden className="admin-tab-hover absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 520, damping: 38 }} /> : null}
                {isActive ? <motion.span layoutId="admin-users-tab-active" aria-hidden className="admin-tab-active absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
                <span className="relative z-10">{view.label}</span>
                <span className="relative z-10 font-mono text-[11px] opacity-75">{view.count}</span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {activeView === "invites" ? (
        <>
          <section className="admin-dashboard-reveal admin-table-surface overflow-hidden">
            <div className="p-md lg:p-lg">
              <div className="flex flex-col gap-xs md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <h2 className="portal-card-title">{dictionary.invitations.title}</h2>
                  <p className="mt-2xs paragraph-small text-[color:var(--muted-foreground)]">{dictionary.invitations.description}</p>
                </div>
                {inviteLoading ? <span className="paragraph-mini text-[color:var(--muted-foreground)]">{dictionary.invitations.updating}</span> : null}
              </div>
              <form className="mt-md grid gap-sm md:grid-cols-[minmax(240px,1fr)_180px_auto]" onSubmit={(event) => { event.preventDefault(); void submitInvite(); }}>
                <label htmlFor="admin-user-invite-email" className="sr-only">{dictionary.invitations.emailLabel}</label>
                <Input id="admin-user-invite-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder={dictionary.invitations.emailPlaceholder} autoComplete="email" disabled={inviteSubmitting} />
                <label htmlFor="admin-user-invite-role" className="sr-only">{dictionary.invitations.roleLabel}</label>
                <select id="admin-user-invite-role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value === "admin" ? "admin" : "staff")} disabled={inviteSubmitting} className="h-11 w-full rounded-xl border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-sm text-[color:var(--foreground)] shadow-xs outline-none transition-[color,box-shadow] focus:border-[color:var(--accent)] focus:ring-[color:var(--ring)] focus:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50">
                  {inviteRoleValues.map((role) => <option key={role} value={role}>{dictionary.roles[role]}</option>)}
                </select>
                <Button type="submit" variant="brand" size="lg" disabled={inviteSubmitting} className="h-11"><Send className="size-4" />{inviteSubmitting ? dictionary.invitations.sending : dictionary.invitations.send}</Button>
              </form>
            </div>
          </section>
          <section className="admin-dashboard-reveal admin-table-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-md py-sm">
              <h2 className="portal-card-title">{dictionary.invitations.pendingTitle}</h2>
              <span className="paragraph-mini font-mono tabular-nums text-[color:var(--muted-foreground)]">{pendingInvites.length}</span>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[760px] table-fixed">
                <TableHeader><TableRow className="border-b border-[color:var(--hairline-strong)] bg-[color:var(--elevate-2)] hover:bg-[color:var(--elevate-2)] [&_th]:h-9 [&_th]:align-middle [&_th]:text-[length:var(--portal-text-micro)] [&_th]:text-[color:var(--foreground)]">
                  <TableHead className="portal-label w-[34%] px-4">{dictionary.invitations.columns.email}</TableHead>
                  <TableHead className="portal-label w-[20%] px-4">{dictionary.invitations.columns.role}</TableHead>
                  <TableHead className="portal-label w-[18%] px-4">{dictionary.invitations.columns.created}</TableHead>
                  <TableHead className="portal-label w-[18%] px-4">{dictionary.invitations.columns.expires}</TableHead>
                  <TableHead className="portal-label w-[10%] px-4 text-right">{dictionary.invitations.columns.actions}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pendingInvites.length === 0 ? (
                    <TableRow className="border-[color:var(--border)]"><TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-[color:var(--muted-foreground)]"><div className="admin-section-icon"><Send className="size-3.5" /></div><p className="text-sm font-semibold text-[color:var(--foreground)]">{dictionary.invitations.emptyTitle}</p><p className="text-sm">{dictionary.invitations.emptyHint}</p></div>
                    </TableCell></TableRow>
                  ) : pendingInvites.map((invite) => (
                    <TableRow key={invite.id} className="admin-row-hover border-[color:var(--border)] [&_td]:py-2">
                      <TableCell className="truncate px-4 paragraph-small font-semibold text-[color:var(--foreground)]">{invite.email}</TableCell>
                      <TableCell className="px-4"><AdminRolePill role={invite.role} dictionary={dictionary} /></TableCell>
                      <TableCell className="px-4 paragraph-small text-[color:var(--muted-foreground)]">{formatAdminDate(invite.createdAt, dictionary.locale)}</TableCell>
                      <TableCell className="px-4 paragraph-small text-[color:var(--muted-foreground)]">{formatAdminDate(invite.expiresAt, dictionary.locale)}</TableCell>
                      <TableCell className="px-4 text-right"><Button type="button" variant="ghost" size="icon-sm" onClick={() => void revokeInvite(invite.id)} disabled={revokingInviteId === invite.id} aria-label={dictionary.invitations.revoke(invite.email)} className="rounded-full text-[color:var(--muted-foreground)] hover:text-[color:var(--destructive)]"><Trash2 className="size-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      ) : null}

      {activeView === "users" ? (
        <section className="admin-dashboard-reveal admin-table-surface flex h-[calc(100dvh-12rem)] min-h-[560px] flex-col overflow-hidden">
          <div aria-busy={loading} className={`min-h-0 flex-1 overflow-auto transition-opacity duration-150 ${loading && rows.length > 0 ? "opacity-60" : ""}`}>
            <Table className="min-w-[860px] table-fixed">
              <TableHeader><TableRow className="border-b border-[color:var(--hairline-strong)] bg-[color:var(--elevate-2)] hover:bg-[color:var(--elevate-2)] [&_th]:h-9 [&_th]:align-middle [&_th]:text-[length:var(--portal-text-micro)] [&_th]:text-[color:var(--foreground)]">
                <TableHead className="portal-label w-12 px-4"><Checkbox checked={allOnPageSelected} onChange={(event) => setAllPageSelection(event.target.checked)} aria-label={dictionary.users.selectAll} /></TableHead>
                <TableHead className="portal-label w-[22%] px-4">{dictionary.users.columns.name}</TableHead>
                <TableHead className="portal-label w-[30%] px-4">{dictionary.users.columns.email}</TableHead>
                <TableHead className="portal-label w-[18%] px-4">{dictionary.users.columns.role}</TableHead>
                <TableHead className="portal-label w-[15%] px-4">{dictionary.users.columns.created}</TableHead>
                <TableHead className="portal-label w-[15%] px-4">{dictionary.users.columns.updated}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? <TableRowsSkeleton rows={8} columns={["action", "text", "text", "chip", "text", "text"]} /> : rows.length === 0 ? (
                  <TableRow className="border-[color:var(--border)]"><TableCell colSpan={6} className="h-36 text-center"><div className="flex flex-col items-center gap-2 text-[color:var(--muted-foreground)]"><div className="admin-section-icon"><Users className="size-3.5" /></div><p className="text-sm font-semibold text-[color:var(--foreground)]">{dictionary.users.emptyTitle}</p><p className="text-sm">{dictionary.users.emptyHint}</p></div></TableCell></TableRow>
                ) : rows.map((row) => {
                  const isSelected = selectedIds.includes(row.profileId);
                  return (
                    <TableRow key={row.profileId} className={`admin-row-hover border-[color:var(--border)] [&_td]:py-2 ${isSelected ? "admin-row-selected" : ""}`}>
                      <TableCell className="w-12 px-4"><Checkbox checked={isSelected} onChange={() => setSelectedIds((current) => current.includes(row.profileId) ? current.filter((id) => id !== row.profileId) : [...current, row.profileId])} aria-label={dictionary.users.selectUser(row.email)} /></TableCell>
                      <TableCell className="px-4"><div className="min-w-0 space-y-0.5"><p className="truncate paragraph-small font-semibold leading-tight text-[color:var(--foreground)]">{row.name}</p><p className="truncate paragraph-mini leading-tight text-[color:var(--muted-foreground)]">{row.profileId}</p></div></TableCell>
                      <TableCell className="truncate px-4 text-sm text-[color:var(--muted-foreground)]">{row.email}</TableCell>
                      <TableCell className="px-4"><DropdownMenu><DropdownMenuTrigger asChild><button type="button" id={`admin-user-role-trigger-${row.profileId}`} className="inline-flex items-center rounded-full" aria-label={dictionary.users.changeRole(row.email)}><AdminRolePill role={row.role} dictionary={dictionary} /></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="min-w-44 rounded-[var(--radius-card)] border-[color:var(--hairline)] bg-[color:var(--popover)] p-1.5 text-[color:var(--popover-foreground)]">{roleValues.filter((role) => role !== row.role).map((role) => <DropdownMenuItem key={role} onClick={() => { setPendingRoleAction({ profileIds: [row.profileId], newRole: role, mode: "single" }); setReason(""); }} className="my-0.5 rounded-[var(--radius)]"><AdminRolePill role={role} dictionary={dictionary} /></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></TableCell>
                      <TableCell className="px-4 text-sm text-[color:var(--muted-foreground)]">{formatAdminDate(row.createdAt, dictionary.locale)}</TableCell>
                      <TableCell className="px-4 text-sm text-[color:var(--muted-foreground)]">{formatAdminDate(row.updatedAt, dictionary.locale)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} summary={dictionary.users.summary(rows.length, total)} previousLabel={dictionary.pagination.previous} nextLabel={dictionary.pagination.next} pageLabel={dictionary.pagination.page} />
        </section>
      ) : null}

      <AlertDialog open={pendingRoleAction !== null} onOpenChange={(open) => { if (!open && !isSubmitting) { setPendingRoleAction(null); setReason(""); } }}>
        <AlertDialogContent className="max-w-[460px] rounded-[var(--radius-panel)]">
          <AlertDialogHeader><AlertDialogTitle className="portal-card-title">{pendingRoleAction?.mode === "bulk" ? dictionary.roleChange.bulkTitle : dictionary.roleChange.singleTitle}</AlertDialogTitle><AlertDialogDescription>{pendingRoleAction?.mode === "bulk" ? dictionary.roleChange.bulkDescription(pendingLabel, pendingRoleAction.profileIds.length) : dictionary.roleChange.singleDescription(pendingLabel)}</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-2"><label htmlFor="admin-role-reason" className="portal-label">{dictionary.roleChange.reason}</label><textarea id="admin-role-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={dictionary.roleChange.reasonPlaceholder} className="min-h-[110px] w-full rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--project-surface-secondary)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]" disabled={isSubmitting} /></div>
          <AlertDialogFooter><AlertDialogCancel className="rounded-full border-[color:var(--border)] px-4 text-xs" disabled={isSubmitting}>{dictionary.roleChange.cancel}</AlertDialogCancel><AlertDialogAction className="rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 text-xs font-semibold text-[color:var(--accent-foreground)]" onClick={(event) => { event.preventDefault(); void submitRoleChange(); }} disabled={isSubmitting}>{isSubmitting ? dictionary.roleChange.applying : dictionary.roleChange.confirm}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
