import { clientProjectsDictionary } from "./dictionary";
import type { ClientProjectMeta } from "../../client-contracts";
import { formatProjectShortDate, isProjectDatePast } from "../shared/formatters";

export function resolveClientMetaPreview(metas: ClientProjectMeta[]) {
  const ordered = [...metas].sort((left, right) => {
    if (left.position !== right.position) return left.position - right.position;
    return (left.targetDate ?? "9999-12-31").localeCompare(right.targetDate ?? "9999-12-31");
  });
  const current = ordered.filter((meta) => meta.status === "in_progress" || meta.status === "delayed").slice(0, 3);
  if (current.length > 0) {
    return {
      label: current.length === 1
        ? clientProjectsDictionary.portal.currentMeta
        : clientProjectsDictionary.portal.currentMetas,
      metas: current,
    };
  }
  const pending = ordered.find((meta) => meta.status === "pending");
  return pending
    ? { label: clientProjectsDictionary.portal.nextMeta, metas: [pending] }
    : null;
}

export function resolveNextClientMeta(
  metas: ClientProjectMeta[],
  todayKey: string | null,
) {
  const incomplete = metas.filter((meta) => meta.status !== "achieved");
  if (!todayKey) return [...incomplete].sort((left, right) => left.position - right.position)[0] ?? null;

  const upcoming = incomplete
    .filter((meta) => meta.targetDate && meta.targetDate >= todayKey)
    .sort((left, right) => left.targetDate!.localeCompare(right.targetDate!) || left.position - right.position);
  if (upcoming[0]) return upcoming[0];

  const overdue = incomplete
    .filter((meta) => meta.targetDate)
    .sort((left, right) => right.targetDate!.localeCompare(left.targetDate!) || left.position - right.position);
  if (overdue[0]) return overdue[0];

  return [...incomplete].sort((left, right) => left.position - right.position)[0] ?? null;
}

export function formatClientProjectDate(dateLike: string | null): string {
  if (!dateLike || Number.isNaN(new Date(dateLike).getTime())) {
    return clientProjectsDictionary.common.noDate;
  }
  return formatProjectShortDate(dateLike, clientProjectsDictionary.common.noDate);
}

export function isClientProjectDateOverdue(dateLike: string | null, now: Date | null): boolean {
  return isProjectDatePast(dateLike, now);
}

const CLIENT_ORGANIZATION_FILTER_STORAGE_KEY = "bw-client-organization-filter";

export function readStoredClientOrganizationFilter(): string {
  if (typeof window === "undefined") return "all";
  try {
    return window.localStorage.getItem(CLIENT_ORGANIZATION_FILTER_STORAGE_KEY) ?? "all";
  } catch {
    return "all";
  }
}

export function storeClientOrganizationFilter(organizationId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLIENT_ORGANIZATION_FILTER_STORAGE_KEY, organizationId);
  } catch {
    // storage unavailable (private mode); selection stays page-local
  }
}

export function resolveClientProjectDetailHref(isStaff: boolean, projectId: string, internalProjectsHref = "/projetos"): string {
  return isStaff ? `${internalProjectsHref}/${encodeURIComponent(projectId)}` : `/account/projetos/${encodeURIComponent(projectId)}`;
}
