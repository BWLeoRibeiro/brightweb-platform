"use client";

import { useEffect, useState } from "react";
import { Filter, Search } from "lucide-react";
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from "@brightweblabs/ui";
import {
  ADMIN_EVENTS,
  dispatchAdminCustomEvent,
  type AdminStateEventDetail,
} from "../events";
import type { AdminManagedRole } from "../users";
import { defaultAdminUiDictionary } from "./dictionary";
import type { AdminUiDictionary } from "./types";

type AdminRoleFilter = "all" | AdminManagedRole;

const roleValues: AdminRoleFilter[] = ["all", "client", "staff", "admin"];

export type AdminToolbarControlsProps = {
  dictionary?: AdminUiDictionary;
};

export function AdminToolbarControls({ dictionary = defaultAdminUiDictionary }: AdminToolbarControlsProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminRoleFilter>("all");
  const [draftRole, setDraftRole] = useState<AdminRoleFilter>("all");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleState = (event: Event) => {
      const detail = (event as CustomEvent<AdminStateEventDetail>).detail;
      if (typeof detail?.search === "string") setSearch(detail.search);
      if (detail?.roleFilter && roleValues.includes(detail.roleFilter)) setRoleFilter(detail.roleFilter);
    };
    window.addEventListener(ADMIN_EVENTS.state, handleState);
    return () => window.removeEventListener(ADMIN_EVENTS.state, handleState);
  }, []);

  const begin = () => {
    setDraftRole(roleFilter);
    setOpen(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex h-9 min-w-[var(--toolbar-search-min-width)] items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-[color:var(--muted-foreground)]">
        <Search className="size-[var(--toolbar-icon-size)] shrink-0" aria-hidden />
        <Input
          value={search}
          onChange={(event) => {
            const value = event.target.value;
            setSearch(value);
            dispatchAdminCustomEvent(ADMIN_EVENTS.setSearch, { query: value });
          }}
          placeholder={dictionary.toolbar.searchPlaceholder}
          aria-label={dictionary.toolbar.searchPlaceholder}
          className="h-8 w-full border-0 bg-transparent px-0 text-[length:var(--text-ui-action)] text-[color:var(--foreground)] shadow-none focus-visible:ring-0"
        />
      </label>

      <Popover open={open} onOpenChange={(next) => next ? begin() : setOpen(false)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--foreground)] transition-colors hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)]"
            onClick={() => open ? setOpen(false) : begin()}
          >
            <Filter className="size-[var(--toolbar-icon-size)] text-[color:var(--muted-foreground)]" aria-hidden />
            {dictionary.toolbar.filters}
            {roleFilter !== "all" ? (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-ui-micro text-accent-foreground">1</span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[var(--toolbar-popover-width)] rounded-[var(--radius-toolbar-popover)] border-[color:var(--hairline)] bg-[color:var(--popover)] p-4 shadow-[var(--shadow-toolbar-popover)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--foreground)]">
              {dictionary.toolbar.filters}
            </span>
            <button
              type="button"
              className="p-0 text-xs font-bold text-[color:var(--muted-foreground)] hover:text-[color:var(--accent)]"
              onClick={() => setDraftRole("all")}
            >
              {dictionary.toolbar.clear}
            </button>
          </div>
          <span className="mb-2 block text-[length:var(--text-ui-micro)] font-extrabold uppercase tracking-[var(--type-tracking-100)] text-[color:var(--muted-foreground)]">
            {dictionary.toolbar.role}
          </span>
          <div className="flex flex-wrap gap-2">
            {roleValues.map((role) => (
              <button
                key={role}
                type="button"
                className={`inline-flex h-[var(--toolbar-chip-height)] items-center rounded-full border px-3 text-[length:var(--text-ui-chip)] font-semibold ${
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
              className="h-9 w-full rounded-[var(--radius-control)] bg-[color:var(--accent)] text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--accent-foreground)]"
              onClick={() => {
                setRoleFilter(draftRole);
                dispatchAdminCustomEvent(ADMIN_EVENTS.setRoleFilter, { role: draftRole });
                setOpen(false);
              }}
            >
              {dictionary.toolbar.apply}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
