import { clientProjectsDictionary } from "./dictionary";
import type { ClientProjectMeta } from "../../client-contracts";

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

export function formatClientProjectDate(dateLike: string | null): string {
  if (!dateLike) return clientProjectsDictionary.common.noDate;
  const value = dateLike.includes("T")
    ? new Date(dateLike)
    : new Date(`${dateLike}T00:00:00`);
  if (Number.isNaN(value.getTime())) return clientProjectsDictionary.common.noDate;
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" }).format(value);
}

export function isClientProjectDateOverdue(dateLike: string | null): boolean {
  if (!dateLike) return false;
  const value = dateLike.includes("T")
    ? new Date(dateLike)
    : new Date(`${dateLike}T00:00:00`);
  return !Number.isNaN(value.getTime()) && value < new Date();
}

export function resolveClientProjectDetailHref(isStaff: boolean, projectId: string, internalProjectsHref = "/projetos"): string {
  return isStaff ? `${internalProjectsHref}/${encodeURIComponent(projectId)}` : `/account/projetos/${encodeURIComponent(projectId)}`;
}
