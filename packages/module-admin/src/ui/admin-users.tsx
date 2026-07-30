"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useShellAction } from "@brightweblabs/app-shell";
import { motion, useReducedMotion } from "motion/react";
import { CalendarClock, RotateCw, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Checkbox, DropdownMenu,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Field, FieldContent, FieldDescription,
  FieldError, FieldLabel, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader,
  TablePagination, TableRow, TableRowsSkeleton,
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

function formatInvitationExpiry(value: string, locale: string, dictionary: AdminUiDictionary) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const days = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000));
  if (days === 0) return dictionary.invitations.expiresToday ?? formatAdminDate(value, locale);
  if (days <= 3 && dictionary.invitations.expirySoon) return dictionary.invitations.expirySoon(days);
  return formatAdminDate(value, locale);
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
  const prefersReducedMotion = useReducedMotion();
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
  const [inviteLoadError, setInviteLoadError] = useState<string | null>(null);
  const [inviteFieldError, setInviteFieldError] = useState<string | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<AdminUserInvitation | null>(null);
  const didRunInitialFetchRef = useRef(false);
  const didLoadInvitationsRef = useRef(false);
  const usersRequestGenerationRef = useRef(0);
  const invitationsRequestGenerationRef = useRef(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 180);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadUsers = useCallback(async () => {
    const generation = ++usersRequestGenerationRef.current;
    setLoading(true);
    try {
      const payload = await client.listUsers({
        page, pageSize, search: debouncedSearch || undefined, role: roleFilter === "all" ? null : roleFilter,
      });
      if (generation === usersRequestGenerationRef.current) {
        setRows(payload.data);
        setTotal(payload.pagination.total);
        setSelectedIds((current) => current.filter((id) => payload.data.some((row) => row.profileId === id)));
      }
    } catch (error) {
      if (generation === usersRequestGenerationRef.current) {
        toast.error(error instanceof Error ? error.message : dictionary.users.loadError);
        setRows([]);
        setTotal(0);
        setSelectedIds([]);
      }
    } finally {
      if (generation === usersRequestGenerationRef.current) {
        setLoading(false);
        dispatchAdminEvent(ADMIN_EVENTS.refreshComplete);
      }
    }
  }, [client, debouncedSearch, dictionary.users.loadError, page, pageSize, roleFilter]);

  const loadInvitations = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (didLoadInvitationsRef.current && !force) return;
    didLoadInvitationsRef.current = true;
    const generation = ++invitationsRequestGenerationRef.current;
    setInviteLoading(true);
    setInviteLoadError(null);
    try {
      const invitations = await client.listInvitations();
      if (generation === invitationsRequestGenerationRef.current) {
        setPendingInvites(invitations.filter((invite) => invite.status === "pending"));
      }
    } catch (error) {
      if (generation === invitationsRequestGenerationRef.current) {
        didLoadInvitationsRef.current = false;
        setInviteLoadError(error instanceof Error ? error.message : dictionary.invitations.loadError);
      }
    } finally {
      if (generation === invitationsRequestGenerationRef.current) setInviteLoading(false);
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

  useShellAction<AdminSetSearchEventDetail | undefined>(ADMIN_EVENTS.setSearch, (detail) => setSearch(detail?.query ?? ""));
  useShellAction<AdminSetRoleFilterEventDetail | undefined>(ADMIN_EVENTS.setRoleFilter, (detail) => {
    setRoleFilter(detail?.role ?? "all");
    setPage(1);
  });
  useShellAction<AdminSetBulkRoleEventDetail | undefined>(ADMIN_EVENTS.setBulkRole, (detail) => {
    if (detail?.role) setBulkTargetRole(detail.role);
  });
  useShellAction(ADMIN_EVENTS.applyBulk, () => handleApplyBulk());
  useShellAction(ADMIN_EVENTS.refresh, () => handleRefresh());

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
    if (!email) { setInviteFieldError(dictionary.invitations.emailRequired); return; }
    setInviteFieldError(null);
    setInviteFeedback(null);
    setInviteSubmitting(true);
    try {
      const created = await client.inviteUser({ email, role: inviteRole });
      setPendingInvites((current) => [created, ...current.filter((invite) => invite.id !== created.id)]);
      toast.success(dictionary.invitations.sent);
      setInviteFeedback(dictionary.invitations.sentTo?.(created.email) ?? dictionary.invitations.sent);
      setInviteEmail("");
      setInviteRole("staff");
    } catch (error) {
      const message = error instanceof Error ? error.message : dictionary.invitations.sendError;
      setInviteFieldError(message);
      toast.error(message);
    } finally {
      setInviteSubmitting(false);
    }
  };

  const revokeInvite = async () => {
    if (!pendingRevoke) return;
    const invitation = pendingRevoke;
    setRevokingInviteId(invitation.id);
    try {
      await client.revokeInvitation(invitation.id);
      setPendingInvites((current) => current.filter((invite) => invite.id !== invitation.id));
      toast.success(dictionary.invitations.revoked);
      setPendingRevoke(null);
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
              <motion.button key={view.id} type="button" onClick={() => setActiveView(view.id)} onMouseEnter={() => setHoveredView(view.id)} onFocus={() => setHoveredView(view.id)} whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }} transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 32 }} aria-pressed={isActive} className={`relative inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-body text-[length:var(--text-ui-action)] font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] motion-reduce:transition-none ${isActive ? "text-[color:var(--accent-foreground)]" : isHovered ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>
                {isHovered ? <motion.span layoutId={prefersReducedMotion ? undefined : "admin-users-tab-hover"} aria-hidden className="admin-tab-hover absolute inset-0 rounded-full" transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 38 }} /> : null}
                {isActive ? <motion.span layoutId={prefersReducedMotion ? undefined : "admin-users-tab-active"} aria-hidden className="admin-tab-active absolute inset-0 rounded-full" transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} /> : null}
                <span className="relative z-10">{view.label}</span>
                <span className="relative z-10 font-mono text-label opacity-75">{view.count}</span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {activeView === "invites" ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(290px,0.72fr)_minmax(0,1.45fr)]">
          <section className="admin-dashboard-reveal admin-table-surface overflow-hidden lg:sticky lg:top-4">
            <div className="border-b border-[color:var(--border)] p-md lg:p-lg">
              <div className="admin-section-icon mb-sm"><Send className="size-3.5" /></div>
              <h2 className="text-title text-foreground">{dictionary.invitations.title}</h2>
              <p className="mt-2xs text-body leading-relaxed text-[color:var(--muted-foreground)]">{dictionary.invitations.description}</p>
            </div>
            <form className="flex flex-col gap-md p-md lg:p-lg" aria-busy={inviteSubmitting} onSubmit={(event) => { event.preventDefault(); void submitInvite(); }}>
              {inviteFeedback ? (
                <div role="status" className="border-l-2 border-[color:var(--semantic-success)] bg-[color:var(--surface-status-success)] px-sm py-xs text-body text-[color:var(--semantic-success-strong)]">
                  {inviteFeedback}
                </div>
              ) : null}
              <Field data-invalid={Boolean(inviteFieldError)}>
                <FieldLabel htmlFor="admin-user-invite-email">{dictionary.invitations.emailLabel}</FieldLabel>
                <FieldContent>
                  <Input id="admin-user-invite-email" type="email" value={inviteEmail} onChange={(event) => { setInviteEmail(event.target.value); setInviteFieldError(null); setInviteFeedback(null); }} placeholder={dictionary.invitations.emailPlaceholder} autoComplete="email" disabled={inviteSubmitting} required aria-invalid={Boolean(inviteFieldError)} aria-describedby={inviteFieldError ? "admin-user-invite-email-error" : "admin-user-invite-hint"} />
                  <FieldError id="admin-user-invite-email-error">{inviteFieldError}</FieldError>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-user-invite-role">{dictionary.invitations.roleLabel}</FieldLabel>
                <FieldContent>
                  <select id="admin-user-invite-role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value === "admin" ? "admin" : "staff")} disabled={inviteSubmitting} className="h-11 w-full rounded-[var(--radius)] border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-body text-[color:var(--foreground)] shadow-xs outline-none transition-[color,box-shadow] focus:border-[color:var(--accent)] focus:ring-[color:var(--ring)] focus:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50">
                    {inviteRoleValues.map((role) => <option key={role} value={role}>{dictionary.roles[role]}</option>)}
                  </select>
                  {dictionary.invitations.roleDescriptions?.[inviteRole] ? <FieldDescription>{dictionary.invitations.roleDescriptions[inviteRole]}</FieldDescription> : null}
                </FieldContent>
              </Field>
              <p id="admin-user-invite-hint" className="text-meta leading-relaxed text-[color:var(--muted-foreground)]">{dictionary.invitations.formHint}</p>
              <Button type="submit" variant="brand" size="lg" disabled={inviteSubmitting} className="h-11 w-full"><Send className="size-4" />{inviteSubmitting ? dictionary.invitations.sending : dictionary.invitations.send}</Button>
            </form>
          </section>

          <section className="admin-dashboard-reveal admin-table-surface min-w-0 overflow-hidden" aria-busy={inviteLoading}>
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-md py-sm">
              <div>
                <h2 className="text-title text-foreground">{dictionary.invitations.pendingTitle}</h2>
                {inviteLoading ? <p className="mt-1 text-meta text-[color:var(--muted-foreground)]">{dictionary.invitations.updating}</p> : null}
              </div>
              <span className="text-meta font-mono tabular-nums text-[color:var(--muted-foreground)]">{pendingInvites.length}</span>
            </div>

            {inviteLoadError ? (
              <div role="alert" className="m-md border-l-2 border-[color:var(--semantic-danger)] bg-[color:var(--surface-status-danger)] p-md">
                <p className="text-body font-semibold text-[color:var(--semantic-danger-strong)]">{dictionary.invitations.loadError}</p>
                <p className="mt-1 text-body text-[color:var(--muted-foreground)]">{inviteLoadError}</p>
                <Button type="button" variant="outline" className="mt-sm" onClick={() => void loadInvitations({ force: true })}><RotateCw className="size-4" />{dictionary.invitations.retry ?? dictionary.invitations.loadError}</Button>
              </div>
            ) : (
              <>
                <div className="space-y-sm p-md md:hidden">
                  {inviteLoading && pendingInvites.length === 0 ? Array.from({ length: 3 }, (_, index) => (
                    <div key={index} className="space-y-3 border border-[color:var(--border)] p-sm"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-6 w-24" /><Skeleton className="h-3 w-1/2" /></div>
                  )) : pendingInvites.length === 0 ? (
                    <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-sm text-center text-[color:var(--muted-foreground)]"><div className="admin-section-icon"><Send className="size-3.5" /></div><p className="text-body font-semibold text-[color:var(--foreground)]">{dictionary.invitations.emptyTitle}</p><p className="max-w-[24rem] text-body">{dictionary.invitations.emptyHint}</p></div>
                  ) : pendingInvites.map((invite) => (
                    <article key={invite.id} className="border border-[color:var(--border)] bg-[color:var(--elevate-1)] p-sm">
                      <div className="flex items-start justify-between gap-sm">
                        <div className="min-w-0"><p className="break-all text-body font-semibold text-[color:var(--foreground)]">{invite.email}</p><p className="mt-1 text-meta text-[color:var(--muted-foreground)]">{dictionary.invitations.columns.created}: {formatAdminDate(invite.createdAt, dictionary.locale)}</p></div>
                        <AdminRolePill role={invite.role} dictionary={dictionary} />
                      </div>
                      <div className="mt-sm flex items-center justify-between gap-sm border-t border-[color:var(--border)] pt-sm">
                        <span className="inline-flex items-center gap-1.5 text-meta text-[color:var(--muted-foreground)]"><CalendarClock className="size-3.5" />{formatInvitationExpiry(invite.expiresAt, dictionary.locale, dictionary)}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setPendingRevoke(invite)} disabled={revokingInviteId === invite.id} aria-label={dictionary.invitations.revoke(invite.email)} className="text-[color:var(--muted-foreground)] hover:text-[color:var(--destructive)]"><Trash2 className="size-4" />{dictionary.invitations.confirmRevoke ?? dictionary.invitations.columns.actions}</Button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <Table className="min-w-[700px] table-fixed">
                    <TableHeader><TableRow className="border-b border-[color:var(--hairline-strong)] bg-[color:var(--elevate-2)] hover:bg-[color:var(--elevate-2)] [&_th]:h-9 [&_th]:align-middle [&_th]:text-micro [&_th]:text-[color:var(--foreground)]">
                      <TableHead className="text-label text-muted-foreground w-[34%] px-4">{dictionary.invitations.columns.email}</TableHead>
                      <TableHead className="text-label text-muted-foreground w-[18%] px-4">{dictionary.invitations.columns.role}</TableHead>
                      <TableHead className="text-label text-muted-foreground w-[18%] px-4">{dictionary.invitations.columns.created}</TableHead>
                      <TableHead className="text-label text-muted-foreground w-[22%] px-4">{dictionary.invitations.columns.expires}</TableHead>
                      <TableHead className="text-label text-muted-foreground w-[8%] px-4 text-right">{dictionary.invitations.columns.actions}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {inviteLoading && pendingInvites.length === 0 ? <TableRowsSkeleton rows={4} columns={["text", "chip", "text", "text", "action"]} /> : pendingInvites.length === 0 ? (
                        <TableRow className="border-[color:var(--border)]"><TableCell colSpan={5} className="h-40 text-center"><div className="flex flex-col items-center gap-2 text-[color:var(--muted-foreground)]"><div className="admin-section-icon"><Send className="size-3.5" /></div><p className="text-body font-semibold text-[color:var(--foreground)]">{dictionary.invitations.emptyTitle}</p><p className="text-body">{dictionary.invitations.emptyHint}</p></div></TableCell></TableRow>
                      ) : pendingInvites.map((invite) => (
                        <TableRow key={invite.id} className="admin-row-hover border-[color:var(--border)] [&_td]:py-3">
                          <TableCell className="truncate px-4 text-body font-semibold text-[color:var(--foreground)]">{invite.email}</TableCell>
                          <TableCell className="px-4"><AdminRolePill role={invite.role} dictionary={dictionary} /></TableCell>
                          <TableCell className="px-4 text-body text-[color:var(--muted-foreground)]">{formatAdminDate(invite.createdAt, dictionary.locale)}</TableCell>
                          <TableCell className="px-4"><span className="inline-flex items-center gap-1.5 text-body text-[color:var(--muted-foreground)]"><CalendarClock className="size-3.5" />{formatInvitationExpiry(invite.expiresAt, dictionary.locale, dictionary)}</span></TableCell>
                          <TableCell className="px-4 text-right"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setPendingRevoke(invite)} disabled={revokingInviteId === invite.id} aria-label={dictionary.invitations.revoke(invite.email)} className="text-[color:var(--muted-foreground)] hover:text-[color:var(--destructive)]"><Trash2 className="size-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {activeView === "users" ? (
        <section className="admin-dashboard-reveal admin-table-surface flex h-[calc(100dvh-12rem)] min-h-[560px] flex-col overflow-hidden">
          <div aria-busy={loading} className={`min-h-0 flex-1 overflow-auto transition-opacity duration-150 ${loading && rows.length > 0 ? "opacity-60" : ""}`}>
            <Table className="min-w-[860px] table-fixed">
              <TableHeader><TableRow className="border-b border-[color:var(--hairline-strong)] bg-[color:var(--elevate-2)] hover:bg-[color:var(--elevate-2)] [&_th]:h-9 [&_th]:align-middle [&_th]:text-micro [&_th]:text-[color:var(--foreground)]">
                <TableHead className="text-label text-muted-foreground w-12 px-4"><Checkbox checked={allOnPageSelected} onChange={(event) => setAllPageSelection(event.target.checked)} aria-label={dictionary.users.selectAll} /></TableHead>
                <TableHead className="text-label text-muted-foreground w-[22%] px-4">{dictionary.users.columns.name}</TableHead>
                <TableHead className="text-label text-muted-foreground w-[30%] px-4">{dictionary.users.columns.email}</TableHead>
                <TableHead className="text-label text-muted-foreground w-[18%] px-4">{dictionary.users.columns.role}</TableHead>
                <TableHead className="text-label text-muted-foreground w-[15%] px-4">{dictionary.users.columns.created}</TableHead>
                <TableHead className="text-label text-muted-foreground w-[15%] px-4">{dictionary.users.columns.updated}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? <TableRowsSkeleton rows={8} columns={["action", "text", "text", "chip", "text", "text"]} /> : rows.length === 0 ? (
                  <TableRow className="border-[color:var(--border)]"><TableCell colSpan={6} className="h-36 text-center"><div className="flex flex-col items-center gap-2 text-[color:var(--muted-foreground)]"><div className="admin-section-icon"><Users className="size-3.5" /></div><p className="text-body font-semibold text-[color:var(--foreground)]">{dictionary.users.emptyTitle}</p><p className="text-body">{dictionary.users.emptyHint}</p></div></TableCell></TableRow>
                ) : rows.map((row) => {
                  const isSelected = selectedIds.includes(row.profileId);
                  return (
                    <TableRow key={row.profileId} className={`admin-row-hover border-[color:var(--border)] [&_td]:py-2 ${isSelected ? "admin-row-selected" : ""}`}>
                      <TableCell className="w-12 px-4"><Checkbox checked={isSelected} onChange={() => setSelectedIds((current) => current.includes(row.profileId) ? current.filter((id) => id !== row.profileId) : [...current, row.profileId])} aria-label={dictionary.users.selectUser(row.email)} /></TableCell>
                      <TableCell className="px-4"><div className="min-w-0 space-y-0.5"><p className="truncate text-body font-semibold leading-tight text-[color:var(--foreground)]">{row.name}</p><p className="truncate text-meta leading-tight text-[color:var(--muted-foreground)]">{row.profileId}</p></div></TableCell>
                      <TableCell className="truncate px-4 text-body text-[color:var(--muted-foreground)]">{row.email}</TableCell>
                      <TableCell className="px-4"><DropdownMenu><DropdownMenuTrigger asChild><button type="button" id={`admin-user-role-trigger-${row.profileId}`} className="inline-flex items-center rounded-full" aria-label={dictionary.users.changeRole(row.email)}><AdminRolePill role={row.role} dictionary={dictionary} /></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="min-w-44 rounded-[var(--radius-card)] border-[color:var(--hairline)] bg-[color:var(--popover)] p-1.5 text-[color:var(--popover-foreground)]">{roleValues.filter((role) => role !== row.role).map((role) => <DropdownMenuItem key={role} onClick={() => { setPendingRoleAction({ profileIds: [row.profileId], newRole: role, mode: "single" }); setReason(""); }} className="my-0.5 rounded-[var(--radius)]"><AdminRolePill role={role} dictionary={dictionary} /></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></TableCell>
                      <TableCell className="px-4 text-body text-[color:var(--muted-foreground)]">{formatAdminDate(row.createdAt, dictionary.locale)}</TableCell>
                      <TableCell className="px-4 text-body text-[color:var(--muted-foreground)]">{formatAdminDate(row.updatedAt, dictionary.locale)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} summary={dictionary.users.summary(rows.length, total)} previousLabel={dictionary.pagination.previous} nextLabel={dictionary.pagination.next} pageLabel={dictionary.pagination.page} />
        </section>
      ) : null}

      <AlertDialog open={pendingRevoke !== null} onOpenChange={(open) => { if (!open && !revokingInviteId) setPendingRevoke(null); }}>
        <AlertDialogContent className="max-w-[440px] rounded-[var(--radius-panel)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-title text-foreground">{dictionary.invitations.confirmRevokeTitle ?? dictionary.invitations.revoke(pendingRevoke?.email ?? "")}</AlertDialogTitle>
            <AlertDialogDescription>{dictionary.invitations.confirmRevokeDescription?.(pendingRevoke?.email ?? "") ?? pendingRevoke?.email}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(revokingInviteId)}>{dictionary.invitations.cancelRevoke ?? dictionary.roleChange.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="border border-[color:var(--destructive)] bg-[color:var(--destructive)] text-[color:var(--destructive-foreground)] hover:bg-[color:var(--destructive)]"
              onClick={(event) => { event.preventDefault(); void revokeInvite(); }}
              disabled={Boolean(revokingInviteId)}
            >
              {revokingInviteId ? dictionary.invitations.revoking ?? dictionary.invitations.updating : dictionary.invitations.confirmRevoke ?? dictionary.invitations.columns.actions}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingRoleAction !== null} onOpenChange={(open) => { if (!open && !isSubmitting) { setPendingRoleAction(null); setReason(""); } }}>
        <AlertDialogContent className="max-w-[460px] rounded-[var(--radius-panel)]">
          <AlertDialogHeader><AlertDialogTitle className="text-title text-foreground">{pendingRoleAction?.mode === "bulk" ? dictionary.roleChange.bulkTitle : dictionary.roleChange.singleTitle}</AlertDialogTitle><AlertDialogDescription>{pendingRoleAction?.mode === "bulk" ? dictionary.roleChange.bulkDescription(pendingLabel, pendingRoleAction.profileIds.length) : dictionary.roleChange.singleDescription(pendingLabel)}</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-2"><label htmlFor="admin-role-reason" className="text-label text-muted-foreground">{dictionary.roleChange.reason}</label><textarea id="admin-role-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={dictionary.roleChange.reasonPlaceholder} className="min-h-[110px] w-full rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--project-surface-secondary)] px-3 py-2 text-body text-[color:var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]" disabled={isSubmitting} /></div>
          <AlertDialogFooter><AlertDialogCancel className="rounded-full border-[color:var(--border)] px-4 text-meta" disabled={isSubmitting}>{dictionary.roleChange.cancel}</AlertDialogCancel><AlertDialogAction className="rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 text-meta font-semibold text-[color:var(--accent-foreground)]" onClick={(event) => { event.preventDefault(); void submitRoleChange(); }} disabled={isSubmitting}>{isSubmitting ? dictionary.roleChange.applying : dictionary.roleChange.confirm}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
