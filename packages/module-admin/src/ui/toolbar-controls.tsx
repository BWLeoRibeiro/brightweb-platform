"use client";

import { useEffect, useState } from "react";
import { Filter, Send } from "lucide-react";
import { ToolbarSearchField, useShellActionDispatch, useShellActionReady, useShellActionsReady } from "@brightweblabs/app-shell";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@brightweblabs/ui";
import {
  ADMIN_EVENTS,
  type AdminInvitationStatusFilter,
  type AdminStateEventDetail,
} from "../events";
import type { AdminManagedRole } from "../users";
import { defaultAdminUiDictionary } from "./dictionary";
import type { AdminUiDictionary } from "./types";

type AdminRoleFilter = "all" | AdminManagedRole;

const roleValues: AdminRoleFilter[] = ["all", "client", "staff", "admin"];
const invitationStatusValues: AdminInvitationStatusFilter[] = ["all", "pending", "accepted", "expired", "revoked"];

export type AdminToolbarControlsProps = {
  dictionary?: AdminUiDictionary;
};

export function AdminToolbarControls({ dictionary = defaultAdminUiDictionary }: AdminToolbarControlsProps) {
  const dispatchShellAction = useShellActionDispatch();
  const inviteReady = useShellActionReady(ADMIN_EVENTS.openInvite);
  const filtersReady = useShellActionsReady([
    ADMIN_EVENTS.setSearch,
    ADMIN_EVENTS.setRoleFilter,
    ADMIN_EVENTS.setInvitationSearch,
    ADMIN_EVENTS.setInvitationStatusFilter,
  ]);
  const [activeView, setActiveView] = useState<"users" | "invites">("users");
  const [search, setSearch] = useState("");
  const [invitationSearch, setInvitationSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminRoleFilter>("all");
  const [invitationStatusFilter, setInvitationStatusFilter] = useState<AdminInvitationStatusFilter>("pending");
  const [draftRole, setDraftRole] = useState<AdminRoleFilter>("all");
  const [draftInvitationStatus, setDraftInvitationStatus] = useState<AdminInvitationStatusFilter>("pending");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleState = (event: Event) => {
      const detail = (event as CustomEvent<AdminStateEventDetail>).detail;
      if (detail?.activeView) setActiveView(detail.activeView);
      if (typeof detail?.search === "string") setSearch(detail.search);
      if (typeof detail?.invitationSearch === "string") setInvitationSearch(detail.invitationSearch);
      if (detail?.roleFilter && roleValues.includes(detail.roleFilter)) setRoleFilter(detail.roleFilter);
      if (detail?.invitationStatusFilter && invitationStatusValues.includes(detail.invitationStatusFilter)) setInvitationStatusFilter(detail.invitationStatusFilter);
    };
    window.addEventListener(ADMIN_EVENTS.state, handleState);
    return () => window.removeEventListener(ADMIN_EVENTS.state, handleState);
  }, []);

  const begin = () => {
    if (activeView === "invites") setDraftInvitationStatus(invitationStatusFilter);
    else setDraftRole(roleFilter);
    setOpen(true);
  };

  const filterIsActive = activeView === "invites" ? invitationStatusFilter !== "pending" : roleFilter !== "all";

  return (
    <div className="flex min-w-max flex-wrap items-center gap-2">
      <ToolbarSearchField
        value={activeView === "invites" ? invitationSearch : search}
        disabled={!filtersReady}
        placeholder={activeView === "invites" ? dictionary.invitations.searchPlaceholder : dictionary.toolbar.searchPlaceholder}
        onChange={(value) => {
          if (activeView === "invites") {
            setInvitationSearch(value);
            dispatchShellAction(ADMIN_EVENTS.setInvitationSearch, { query: value });
          } else {
            setSearch(value);
            dispatchShellAction(ADMIN_EVENTS.setSearch, { query: value });
          }
        }}
      />

      <Popover open={open} onOpenChange={(next) => next ? begin() : setOpen(false)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={!filtersReady}
          >
            <Filter data-icon="inline-start" className="text-[color:var(--muted-foreground)]" aria-hidden />
            {dictionary.toolbar.filters}
            {filterIsActive ? (
              <span className="text-data-sm inline-flex size-5 items-center justify-center rounded-full bg-accent text-accent-foreground">1</span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" collisionPadding={12} className="w-[min(var(--toolbar-popover-width),calc(100vw-2rem))] rounded-[var(--radius-toolbar-popover)] border-[color:var(--hairline)] bg-[color:var(--popover)] p-4 shadow-[var(--shadow-toolbar-popover)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-body text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--foreground)]">
              {dictionary.toolbar.filters}
            </span>
            <Button
              type="button"
              variant="link"
              size="link"
              className="text-meta text-[color:var(--muted-foreground)]"
              onClick={() => activeView === "invites" ? setDraftInvitationStatus("pending") : setDraftRole("all")}
            >
              {dictionary.toolbar.clear}
            </Button>
          </div>
          <span className="mb-2 block text-label text-[color:var(--muted-foreground)]">
            {activeView === "invites" ? dictionary.invitations.statusFilterLabel : dictionary.toolbar.role}
          </span>
          <div className="flex flex-wrap gap-2">
            {activeView === "invites" ? invitationStatusValues.map((status) => (
              <button
                key={status}
                type="button"
                className={`inline-flex h-[var(--toolbar-chip-height)] cursor-pointer items-center rounded-full border px-3 text-meta text-[length:var(--text-ui-chip)] font-semibold ${
                  draftInvitationStatus === status
                    ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)] text-[color:var(--foreground)]"
                    : "border-[color:var(--hairline)] bg-[color:var(--elevate-1)] text-[color:var(--foreground)]"
                }`}
                onClick={() => setDraftInvitationStatus(status)}
              >
                {dictionary.invitations.statusFilters[status]}
              </button>
            )) : roleValues.map((role) => (
              <button
                key={role}
                type="button"
                className={`inline-flex h-[var(--toolbar-chip-height)] cursor-pointer items-center rounded-full border px-3 text-meta text-[length:var(--text-ui-chip)] font-semibold ${
                  draftRole === role
                    ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)] text-[color:var(--foreground)]"
                    : "border-[color:var(--hairline)] bg-[color:var(--elevate-1)] text-[color:var(--foreground)]"
                }`}
                onClick={() => setDraftRole(role)}
              >
                {role === "all" ? dictionary.toolbar.allRoles : dictionary.roles[role]}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                if (activeView === "invites") {
                  setInvitationStatusFilter(draftInvitationStatus);
                  dispatchShellAction(ADMIN_EVENTS.setInvitationStatusFilter, { status: draftInvitationStatus });
                } else {
                  setRoleFilter(draftRole);
                  dispatchShellAction(ADMIN_EVENTS.setRoleFilter, { role: draftRole });
                }
                setOpen(false);
              }}
            >
              {dictionary.toolbar.apply}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        disabled={!inviteReady}
        onClick={() => dispatchShellAction(ADMIN_EVENTS.openInvite)}
      >
        <Send data-icon="inline-start" aria-hidden />
        {dictionary.invitations.open}
      </Button>
    </div>
  );
}
