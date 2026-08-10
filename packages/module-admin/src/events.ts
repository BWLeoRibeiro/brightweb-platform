import type { AdminManagedRole } from "./users";

export const ADMIN_EVENTS = {
  state: "admin:state",
  setSearch: "admin:set-search",
  setRoleFilter: "admin:set-role-filter",
  setInvitationSearch: "admin:set-invitation-search",
  setInvitationStatusFilter: "admin:set-invitation-status-filter",
  setBulkRole: "admin:set-bulk-role",
  applyBulk: "admin:apply-bulk",
  openInvite: "admin:open-invite",
  refresh: "admin:refresh",
  refreshComplete: "admin:refresh-complete",
} as const;

export type AdminStateEventDetail = {
  activeView?: "users" | "invites";
  roleFilter?: "all" | AdminManagedRole;
  search?: string;
  invitationSearch?: string;
  invitationStatusFilter?: AdminInvitationStatusFilter;
  selectedCount?: number;
  bulkRole?: AdminManagedRole;
  isApplyingBulk?: boolean;
};

export type AdminSetSearchEventDetail = { query?: string };
export type AdminSetRoleFilterEventDetail = { role?: "all" | AdminManagedRole };
export type AdminInvitationStatusFilter = "all" | "pending" | "accepted" | "expired" | "revoked";
export type AdminSetInvitationSearchEventDetail = { query?: string };
export type AdminSetInvitationStatusFilterEventDetail = { status?: AdminInvitationStatusFilter };
export type AdminSetBulkRoleEventDetail = { role?: AdminManagedRole };

export function dispatchAdminEvent(name: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(name));
}

export function dispatchAdminCustomEvent<T>(name: string, detail: T) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
