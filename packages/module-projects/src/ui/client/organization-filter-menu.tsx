"use client";

import { useId } from "react";
import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  InitialsAvatar,
  StatusPill,
} from "@brightweblabs/ui";
import type { ClientOrganizationMembership } from "../../client-contracts";
import { clientProjectsDictionary } from "./dictionary";

export type ClientOrganizationFilterOption = {
  id: string;
  name: string;
  role?: ClientOrganizationMembership["role"];
};

function organizationRoleLabel(role: ClientOrganizationMembership["role"]) {
  return role === "admin"
    ? clientProjectsDictionary.portal.organizationAdmin
    : clientProjectsDictionary.portal.organizationMember;
}

export function OrganizationFilterMenu({
  organizations,
  selectedOrganizationId,
  onSelect,
  description,
  surface = "hero",
}: {
  organizations: ClientOrganizationFilterOption[];
  selectedOrganizationId: string;
  onSelect: (organizationId: string) => void;
  description?: string;
  surface?: "hero" | "light";
}) {
  const labelId = useId();
  const multiple = organizations.length > 1;
  const label = multiple
    ? clientProjectsDictionary.portal.yourOrganizations
    : clientProjectsDictionary.portal.yourOrganization;
  const selected = multiple
    ? organizations.find((organization) => organization.id === selectedOrganizationId) ?? null
    : organizations[0] ?? null;

  const identity = (
    <>
      {selected ? (
        <InitialsAvatar label={selected.name} tone={surface === "hero" ? "inverse" : "client"} className="size-10 shrink-0" />
      ) : (
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Building2 aria-hidden className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-title">
          {selected ? selected.name : clientProjectsDictionary.portal.allOrganizations}
        </span>
        {selected?.role ? (
          <StatusPill token="--role-client" className="mt-1">
            {organizationRoleLabel(selected.role)}
          </StatusPill>
        ) : !selected ? (
          <span className={surface === "hero" ? "block truncate text-meta text-[color:var(--project-hero-muted)]" : "block truncate text-meta text-muted-foreground"}>
            {organizations.map((organization) => organization.name).join(" · ")}
          </span>
        ) : null}
      </span>
    </>
  );
  const identityCardClassName = surface === "hero"
    ? "mt-2 flex h-20 w-full items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-surface-raised)] p-4 text-left text-[color:var(--project-hero-foreground)] shadow-none"
    : "mt-2 flex h-20 w-full items-center gap-3 rounded-[var(--radius-card)] border border-border/60 bg-background/75 p-4 text-left text-foreground shadow-[var(--dashboard-shadow-sm)]";
  const interactiveClassName = surface === "hero"
    ? "hover:border-[color:var(--accent)] focus-visible:border-[color:var(--accent)] focus-visible:ring-[color:var(--accent)]"
    : "hover:border-ring focus-visible:border-ring focus-visible:ring-ring";
  const mutedClassName = surface === "hero" ? "text-[color:var(--project-hero-muted)]" : "text-muted-foreground";

  return (
    <section className="min-w-0 w-full lg:w-80 lg:justify-self-end" aria-labelledby={labelId}>
      <p id={labelId} className={`text-label lg:text-right ${mutedClassName}`}>
        {label}
      </p>
      {multiple ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`${identityCardClassName} ${interactiveClassName} group min-w-0 transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none`}
            >
              {identity}
              <ChevronDown
                aria-hidden
                className={`size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none ${mutedClassName}`}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-[var(--radix-dropdown-menu-trigger-width)] max-w-[calc(100vw-2rem)]">
            <DropdownMenuRadioGroup value={selected ? selected.id : "all"} onValueChange={onSelect}>
              <DropdownMenuRadioItem value="all" className="min-h-11">
                {clientProjectsDictionary.portal.allOrganizations}
              </DropdownMenuRadioItem>
              {organizations.map((organization) => (
                <DropdownMenuRadioItem key={organization.id} value={organization.id} className="min-h-11">
                  <span className="min-w-0">
                    <span className="block truncate text-body font-semibold">{organization.name}</span>
                    {organization.role ? (
                      <span className="block text-meta text-muted-foreground">{organizationRoleLabel(organization.role)}</span>
                    ) : null}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className={identityCardClassName}>{identity}</div>
      )}
      {description ? (
        <p className={`mt-2 text-meta lg:text-right ${mutedClassName}`}>
          {description}
        </p>
      ) : null}
    </section>
  );
}
