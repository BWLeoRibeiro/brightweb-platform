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
}: {
  organizations: ClientOrganizationFilterOption[];
  selectedOrganizationId: string;
  onSelect: (organizationId: string) => void;
  description?: string;
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
        <InitialsAvatar label={selected.name} tone="inverse" className="size-10 shrink-0" />
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
          <span className="block truncate text-meta" style={{ color: "var(--project-hero-muted)" }}>
            {organizations.map((organization) => organization.name).join(" · ")}
          </span>
        ) : null}
      </span>
    </>
  );
  const identityCardClassName = "mt-2 flex h-20 w-full items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-surface-raised)] p-4 text-left text-[color:var(--project-hero-foreground)] shadow-none";

  return (
    <section className="min-w-0 w-full lg:w-80 lg:justify-self-end" aria-labelledby={labelId}>
      <p id={labelId} className="text-label lg:text-right" style={{ color: "var(--project-hero-muted)" }}>
        {label}
      </p>
      {multiple ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`${identityCardClassName} group min-w-0 transition-[border-color,box-shadow] hover:border-[color:var(--accent)] focus-visible:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] motion-reduce:transition-none`}
            >
              {identity}
              <ChevronDown
                aria-hidden
                className="size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                style={{ color: "var(--project-hero-muted)" }}
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
        <p className="mt-2 text-meta lg:text-right" style={{ color: "var(--project-hero-muted)" }}>
          {description}
        </p>
      ) : null}
    </section>
  );
}
