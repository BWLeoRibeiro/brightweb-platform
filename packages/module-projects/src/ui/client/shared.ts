import { clientProjectsDictionary } from "./dictionary";

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

export function resolveClientProjectDetailHref(isStaff: boolean, projectId: string): string {
  return isStaff ? `/projects/${projectId}` : `/account/projetos/${projectId}`;
}
