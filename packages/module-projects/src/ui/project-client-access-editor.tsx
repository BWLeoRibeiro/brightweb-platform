"use client";

import { useState } from "react";
import { Building2, Eye, EyeOff, Search, ShieldCheck, Users } from "lucide-react";
import { Checkbox, RoleBadge, SearchField } from "@brightweblabs/ui";
import type { ProjectClientAccessMode } from "../contracts";
import type { ProjectClientAccessEligibleClient } from "../client-contracts";
import { hasSelectedClientOrganizationWithoutAudience } from "../client-access-validation";
import { cn } from "./utils";
import { projectAccessDictionary } from "./project-access-dictionary";

export type ClientAccessOrganizationOption = {
  organizationId: string;
  organizationName: string;
  isPrimary: boolean;
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
  all_org_clients: {
    ...projectAccessDictionary.modes.all_org_clients,
    icon: Building2,
  },
  selected_clients: {
    ...projectAccessDictionary.modes.selected_clients,
    icon: Users,
  },
  hidden: {
    ...projectAccessDictionary.modes.hidden,
    icon: EyeOff,
  },
};

const ORGANIZATION_ROLE_TOKENS = {
  admin: "--role-admin",
  member: "--role-client",
} as const;

export function getClientAccessDraftError(value: ClientAccessDraft): string | null {
  if (value.mode === "hidden") return null;
  const organization = value.organizations.find((item) => item.isPrimary) ?? value.organizations[0];
  if (!organization) return projectAccessDictionary.editor.missingProjectOrganization;
  if (hasSelectedClientOrganizationWithoutAudience(value.mode, [organization])) {
    return projectAccessDictionary.editor.selectClient;
  }
  return null;
}

export function clientAccessDraftToPayload(value: ClientAccessDraft) {
  const organization = value.organizations.find((item) => item.isPrimary) ?? value.organizations[0];
  return {
    mode: value.mode,
    organizations: value.mode === "hidden" || !organization
      ? []
      : [{
        organizationId: organization.organizationId,
        selectedProfileIds: value.mode === "selected_clients" ? organization.selectedProfileIds : [],
      }],
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
  showAudienceQuestion = true,
  compactModes = false,
}: {
  value: ClientAccessDraft;
  onChange: (value: ClientAccessDraft) => void;
  disabled?: boolean;
  idPrefix?: string;
  showIntroduction?: boolean;
  showAudienceQuestion?: boolean;
  compactModes?: boolean;
}) {
  const [search, setSearch] = useState("");
  const organization = value.organizations.find((item) => item.isPrimary) ?? value.organizations[0];
  const selectedClientCount = organization?.selectedProfileIds.length ?? 0;
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-PT");
  const visibleClients = organization?.eligibleClients.filter((client) => (
    !normalizedSearch
    || client.label.toLocaleLowerCase("pt-PT").includes(normalizedSearch)
    || (client.email ?? "").toLocaleLowerCase("pt-PT").includes(normalizedSearch)
  )) ?? [];
  const validationError = getClientAccessDraftError(value);
  const hasInlineClientError = Boolean(
    organization && hasSelectedClientOrganizationWithoutAudience(value.mode, [organization]),
  );

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

      <fieldset className={compactModes ? undefined : "space-y-2"} disabled={disabled}>
        <legend className={showAudienceQuestion ? "mb-2 text-label font-semibold text-foreground" : "sr-only"}>{projectAccessDictionary.editor.audienceQuestion}</legend>
        <div className={compactModes ? "overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]" : "space-y-2"}>
          {(Object.keys(CLIENT_ACCESS_MODE_COPY) as ProjectClientAccessMode[]).map((mode) => {
            const copy = CLIENT_ACCESS_MODE_COPY[mode];
            const Icon = copy.icon;
            const checked = value.mode === mode;
            const unavailable = mode !== "hidden" && !organization;
            return (
              <label
                key={mode}
                className={cn(
                  "group flex min-h-16 cursor-pointer items-start gap-3 transition-colors has-[:focus-visible]:relative has-[:focus-visible]:z-10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--ring)] has-[:focus-visible]:ring-inset",
                  compactModes
                    ? "border-t border-[color:var(--border)] px-3 py-2.5 first:border-t-0"
                    : "rounded-xl border px-3.5 py-3",
                  checked
                    ? compactModes
                      ? "bg-[color:var(--primary)]/[0.055]"
                      : "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.055]"
                    : compactModes
                      ? "bg-[color:var(--card)] hover:bg-[color:var(--muted)]/35"
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
                  tabIndex={checked ? 0 : -1}
                  onChange={() => onChange({ ...value, mode })}
                  className="sr-only"
                />
                <span className={cn(
                  "mt-0.5 flex shrink-0 items-center justify-center rounded-lg border transition-colors",
                  compactModes ? "size-7" : "size-8",
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
        </div>
      </fieldset>

      {value.mode !== "hidden" ? (
        <section className="space-y-3" aria-labelledby={`${idPrefix}-organization-heading`}>
          <div>
            <h3 id={`${idPrefix}-organization-heading`} className="text-label font-semibold text-foreground">
              {projectAccessDictionary.editor.organizationTitle}
            </h3>
            <p className="mt-0.5 text-meta text-muted-foreground">{projectAccessDictionary.editor.organizationDescription}</p>
          </div>

          {value.mode === "selected_clients" && organization ? (
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

          {!organization ? (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] px-4 py-6 text-center">
              <Building2 className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-body font-semibold text-foreground">{projectAccessDictionary.editor.noOrganizationTitle}</p>
              <p className="mt-1 text-meta text-muted-foreground">{projectAccessDictionary.editor.noOrganizationDescription}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-background">
              <div className="flex items-center gap-3 px-3.5 py-3">
                <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">{organization.organizationName}</span>
                {value.mode === "selected_clients" ? (
                  <span className="shrink-0 rounded-full bg-[color:var(--muted)] px-2 py-0.5 text-micro font-semibold text-muted-foreground">
                    {projectAccessDictionary.editor.organizationSelected(organization.selectedProfileIds.length)}
                  </span>
                ) : null}
              </div>

              {value.mode === "selected_clients" ? (
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
                            {client.organizationRole ? (
                              <RoleBadge
                                role={client.organizationRole}
                                label={client.organizationRole === "admin"
                                  ? projectAccessDictionary.editor.organizationAdmin
                                  : projectAccessDictionary.editor.organizationMember}
                                tokenMap={ORGANIZATION_ROLE_TOKENS}
                                className="shrink-0"
                              />
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {organization.selectedProfileIds.length === 0 ? (
                    <p role="alert" className="mt-2 text-meta font-semibold text-semantic-danger-strong">
                      {projectAccessDictionary.editor.selectClient}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {validationError && !hasInlineClientError ? (
        <p role="alert" className="text-meta font-semibold text-semantic-danger-strong">{validationError}</p>
      ) : null}
    </div>
  );
}
