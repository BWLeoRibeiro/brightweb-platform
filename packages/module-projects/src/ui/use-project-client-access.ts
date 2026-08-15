"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectClientAccessMode } from "../contracts";
import { useProjectsUiClient } from "./context";
import {
  clientAccessDraftToPayload,
  type ClientAccessDraft,
  type ClientAccessOrganizationOption,
} from "./project-client-access-editor";
import { projectAccessDictionary } from "./project-access-dictionary";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isClientAccessMode(value: unknown): value is ProjectClientAccessMode {
  return value === "hidden" || value === "all_org_clients" || value === "selected_clients";
}

export function parseClientAccessDraft(value: unknown): ClientAccessDraft | null {
  const candidate = isRecord(value) && isRecord(value.data) ? value.data : value;
  if (!isRecord(candidate) || !isClientAccessMode(candidate.mode) || !Array.isArray(candidate.organizations)) return null;

  const organizations: ClientAccessOrganizationOption[] = [];
  for (const item of candidate.organizations) {
    if (!isRecord(item) || typeof item.organizationId !== "string" || typeof item.organizationName !== "string") return null;
    const eligibleClients = Array.isArray(item.eligibleClients)
      ? item.eligibleClients.flatMap((client) => {
        if (!isRecord(client) || typeof client.profileId !== "string" || typeof client.label !== "string") return [];
        return [{
          profileId: client.profileId,
          label: client.label,
          email: typeof client.email === "string" ? client.email : null,
          organizationRole: client.organizationRole === "admin" ? "admin" as const : client.organizationRole === "member" ? "member" as const : null,
        }];
      })
      : [];
    organizations.push({
      organizationId: item.organizationId,
      organizationName: item.organizationName,
      isPrimary: item.isPrimary === true,
      // Older management responses contained selected organizations only. Treat
      // a missing flag as selected so the editor remains backwards compatible.
      selected: typeof item.selectedForClientAccess === "boolean"
        ? item.selectedForClientAccess
        : typeof item.selected === "boolean"
          ? item.selected
          : true,
      eligibleClients,
      selectedProfileIds: Array.isArray(item.selectedProfileIds)
        ? item.selectedProfileIds.filter((profileId): profileId is string => typeof profileId === "string")
        : [],
    });
  }
  const primaryOrganization = organizations.find((organization) => organization.isPrimary) ?? organizations[0];

  return {
    mode: candidate.mode,
    organizations: primaryOrganization
      ? [{ ...primaryOrganization, selected: candidate.mode !== "hidden" }]
      : [],
    clientSummary: typeof candidate.clientSummary === "string" ? candidate.clientSummary : null,
    clientScope: typeof candidate.clientScope === "string" ? candidate.clientScope : null,
    clientContactProfileId: typeof candidate.clientContactProfileId === "string" ? candidate.clientContactProfileId : null,
  };
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.error === "string") return payload.error;
  if (isRecord(payload.error) && typeof payload.error.message === "string") return payload.error.message;
  return fallback;
}

export function useProjectClientAccess(projectId: string, enabled = true) {
  const client = useProjectsUiClient();
  const [data, setData] = useState<ClientAccessDraft | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    client.requestRaw(`/api/projects/${projectId}/client-access`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(errorMessage(payload, projectAccessDictionary.resource.loadError));
        const parsed = parseClientAccessDraft(payload);
        if (!parsed) throw new Error(projectAccessDictionary.resource.invalidLoadResponse);
        setData(parsed);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : projectAccessDictionary.resource.loadError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [client, enabled, projectId, reloadKey]);

  const save = useCallback(async (draft: ClientAccessDraft) => {
    setIsSaving(true);
    try {
      const response = await client.requestRaw(`/api/projects/${projectId}/client-access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientAccessDraftToPayload(draft)),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload, projectAccessDictionary.resource.saveError));
      const parsed = parseClientAccessDraft(payload);
      if (!parsed) throw new Error(projectAccessDictionary.resource.invalidSaveResponse);
      setData(parsed);
      return parsed;
    } finally {
      setIsSaving(false);
    }
  }, [client, projectId]);

  return useMemo(() => ({ data, isLoading, isSaving, loadError, reload, save }), [data, isLoading, isSaving, loadError, reload, save]);
}
