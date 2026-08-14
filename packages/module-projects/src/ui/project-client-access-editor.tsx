"use client";

import { useState } from "react";
import { Building2, Eye, EyeOff, Search, ShieldCheck, Users } from "lucide-react";
import { Checkbox, SearchField } from "@brightweblabs/ui";
import type { ProjectClientAccessMode } from "../contracts";
import type { ProjectClientAccessEligibleClient } from "../client-contracts";
import { hasSelectedClientOrganizationWithoutAudience } from "../client-access-validation";
import { cn } from "./utils";
import { projectAccessDictionary } from "./project-access-dictionary";

export type ClientAccessOrganizationOption = {
  organizationId: string;
  organizationName: string;
  selected: boolean;
  eligibleClients: ProjectClientAccessEligibleClient[];
  selectedProfileIds: string[];
};

export type ClientAccessDraft = {
  mode: ProjectClientAccessMode;
  organizations: ClientAccessOrganizationOption[];
  clientSummary?: string | null;
  clientScope?: string | null;
  clientContactProfileId?: string | null;
};

export const CLIENT_ACCESS_MODE_COPY: Record<ProjectClientAccessMode, {
  title: string;
  description: string;
  icon: typeof Eye;
}> = {
  hidden: {
    ...projectAccessDictionary.modes.hidden,
    icon: EyeOff,
  },
  all_org_clients: {
    ...projectAccessDictionary.modes.all_org_clients,
    icon: Building2,
  },
  selected_clients: {
    ...projectAccessDictionary.modes.selected_clients,
    icon: Users,
  },
};

export function getClientAccessDraftError(value: ClientAccessDraft): string | null {
  if (value.mode === "hidden") return null;
  const selectedOrganizations = value.organizations.filter((organization) => organization.selected);
  if (selectedOrganizations.length === 0) return projectAccessDictionary.editor.selectOrganization;
  if (hasSelectedClientOrganizationWithoutAudience(value.mode, selectedOrganizations)) {
    return projectAccessDictionary.editor.selectClientPerOrganization;
  }
  return null;
}

export function clientAccessDraftToPayload(value: ClientAccessDraft) {
  return {
    mode: value.mode,
    organizations: value.mode === "hidden"
      ? []
      : value.organizations
        .filter((organization) => organization.selected)
        .map((organization) => ({
          organizationId: organization.organizationId,
          selectedProfileIds: value.mode === "selected_clients" ? organization.selectedProfileIds : [],
        })),
    ...(value.clientSummary !== undefined ? { clientSummary: value.clientSummary } : {}),
    ...(value.clientScope !== undefined ? { clientScope: value.clientScope } : {}),
    ...(value.clientContactProfileId !== undefined ? { clientContactProfileId: value.clientContactProfileId } : {}),
  };
}

function updateOrganization(
  value: ClientAccessDraft,
  organizationId: string,
  update: (organization: ClientAccessOrganizationOption) => ClientAccessOrganizationOption,
): ClientAccessDraft {
  return {
    ...value,
    organizations: value.organizations.map((organization) => (
      organization.organizationId === organizationId ? update(organization) : organization
    )),
  };
}

export function ProjectClientAccessEditor({
  value,
  onChange,
  disabled = false,
  idPrefix = "project-client-access",
  showIntroduction = true,
}: {
  value: ClientAccessDraft;
  onChange: (value: ClientAccessDraft) => void;
  disabled?: boolean;
  idPrefix?: string;
  showIntroduction?: boolean;
}) {
  const [search, setSearch] = useState("");
  const selectedOrganizations = value.organizations.filter((organization) => organization.selected);
  const selectedClientCount = new Set(selectedOrganizations.flatMap((organization) => organization.selectedProfileIds)).size;
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-PT");

  return (
    <div className="space-y-4">
      {showIntroduction ? (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 px-3.5 py-3">
          <div className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[color:var(--primary)]" aria-hidden="true" />
            <div>
              <p className="text-body font-semibold text-foreground">{projectAccessDictionary.editor.separateTitle}</p>
              <p className="mt-0.5 text-meta leading-relaxed text-muted-foreground">
                {projectAccessDictionary.editor.separateDescription}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="mb-2 text-label font-semibold text-foreground">{projectAccessDictionary.editor.audienceQuestion}</legend>
        {(Object.keys(CLIENT_ACCESS_MODE_COPY) as ProjectClientAccessMode[]).map((mode) => {
          const copy = CLIENT_ACCESS_MODE_COPY[mode];
          const Icon = copy.icon;
          const checked = value.mode === mode;
          const unavailable = mode !== "hidden" && value.organizations.length === 0;
          return (
            <label
              key={mode}
              className={cn(
                "group flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors focus-within:ring-2 focus-within:ring-[color:var(--ring)] focus-within:ring-offset-2",
                checked
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.055]"
                  : "border-[color:var(--border)] bg-background hover:bg-[color:var(--muted)]/35",
                (disabled || unavailable) && "cursor-not-allowed opacity-55",
              )}
            >
              <input
                type="radio"
                name={`${idPrefix}-mode`}
                value={mode}
                checked={checked}
                disabled={disabled || unavailable}
                onChange={() => onChange({ ...value, mode })}
                className="sr-only"
              />
              <span className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                checked
                  ? "border-[color:var(--primary)]/25 bg-[color:var(--primary)]/10 text-[color:var(--primary)]"
                  : "border-[color:var(--border)] text-muted-foreground",
              )}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-foreground">{copy.title}</span>
                <span className="mt-0.5 block text-meta leading-relaxed text-muted-foreground">{copy.description}</span>
              </span>
              <span className={cn(
                "mt-1 size-4 shrink-0 rounded-full border-[5px] transition-colors",
                checked ? "border-[color:var(--primary)] bg-background" : "border-[color:var(--border)] bg-background",
              )} aria-hidden="true" />
            </label>
          );
        })}
      </fieldset>

      {value.mode !== "hidden" ? (
        <section className="space-y-3" aria-labelledby={`${idPrefix}-organizations-heading`}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 id={`${idPrefix}-organizations-heading`} className="text-label font-semibold text-foreground">
                {projectAccessDictionary.editor.organizationsTitle}
              </h3>
              <p className="mt-0.5 text-meta text-muted-foreground">{projectAccessDictionary.editor.organizationsDescription}</p>
            </div>
            <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
              {selectedOrganizations.length}/{value.organizations.length}
            </span>
          </div>

          {value.mode === "selected_clients" && selectedOrganizations.length > 0 ? (
            <div className="space-y-1.5">
              <SearchField
                size="sm"
                value={search}
                onChange={setSearch}
                onClear={() => setSearch("")}
                placeholder={projectAccessDictionary.editor.searchClients}
              />
              <p className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
                <Search className="size-3.5" aria-hidden="true" />
                {projectAccessDictionary.editor.selectedClients(selectedClientCount)}
              </p>
            </div>
          ) : null}

          {value.organizations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] px-4 py-6 text-center">
              <Building2 className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-body font-semibold text-foreground">{projectAccessDictionary.editor.noOrganizationsTitle}</p>
              <p className="mt-1 text-meta text-muted-foreground">{projectAccessDictionary.editor.noOrganizationsDescription}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {value.organizations.map((organization) => {
                const selected = organization.selected;
                const visibleClients = organization.eligibleClients.filter((client) => (
                  !normalizedSearch
                  || client.label.toLocaleLowerCase("pt-PT").includes(normalizedSearch)
                  || (client.email ?? "").toLocaleLowerCase("pt-PT").includes(normalizedSearch)
                ));
                return (
                  <div key={organization.organizationId} className={cn(
                    "overflow-hidden rounded-xl border transition-colors",
                    selected ? "border-[color:var(--primary)]/35 bg-[color:var(--primary)]/[0.025]" : "border-[color:var(--border)] bg-background",
                  )}>
                    <label className="flex cursor-pointer items-center gap-3 px-3.5 py-3">
                      <Checkbox
                        checked={selected}
                        disabled={disabled}
                        onChange={() => onChange(updateOrganization(value, organization.organizationId, (current) => ({
                          ...current,
                          selected: !current.selected,
                        })))}
                      />
                      <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">{organization.organizationName}</span>
                      {value.mode === "selected_clients" && selected ? (
                        <span className="shrink-0 rounded-full bg-[color:var(--muted)] px-2 py-0.5 text-micro font-semibold text-muted-foreground">
                          {projectAccessDictionary.editor.organizationSelected(organization.selectedProfileIds.length)}
                        </span>
                      ) : null}
                    </label>

                    {value.mode === "selected_clients" && selected ? (
                      <div className="border-t border-[color:var(--border)] px-3.5 py-3">
                        {organization.eligibleClients.length === 0 ? (
                          <p className="text-meta text-muted-foreground">{projectAccessDictionary.editor.noActiveClients}</p>
                        ) : visibleClients.length === 0 ? (
                          <p className="text-meta text-muted-foreground">{projectAccessDictionary.editor.noSearchResults}</p>
                        ) : (
                          <div className="space-y-1.5">
                            {visibleClients.map((client) => {
                              const checked = organization.selectedProfileIds.includes(client.profileId);
                              return (
                                <label key={client.profileId} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-[color:var(--muted)]/50">
                                  <Checkbox
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={() => onChange(updateOrganization(value, organization.organizationId, (current) => ({
                                      ...current,
                                      selectedProfileIds: checked
                                        ? current.selectedProfileIds.filter((profileId) => profileId !== client.profileId)
                                        : [...current.selectedProfileIds, client.profileId],
                                    })))}
                                  />
                                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--muted)] text-micro font-bold text-muted-foreground">
                                    {client.label.trim().slice(0, 1).toLocaleUpperCase("pt-PT") || "?"}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-body font-semibold text-foreground">{client.label}</span>
                                    {client.email ? <span className="block truncate text-meta text-muted-foreground">{client.email}</span> : null}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        {organization.selectedProfileIds.length === 0 ? (
                          <p role="alert" className="mt-2 text-meta font-semibold text-semantic-danger-strong">
                            {projectAccessDictionary.editor.selectClientForOrganization(organization.organizationName)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {getClientAccessDraftError(value) ? (
        <p role="alert" className="text-meta font-semibold text-semantic-danger-strong">{getClientAccessDraftError(value)}</p>
      ) : null}
    </div>
  );
}
