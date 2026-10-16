/** The input is local wall time; persistence stores an instant in UTC. */
export function toLocalDateTime(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalDateTime(value: string, originalInstant?: string | null): string {
  // Preserve an unchanged stored instant, including seconds and the later DST occurrence.
  if (originalInstant && toLocalDateTime(originalInstant) === value) return new Date(originalInstant).toISOString();
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || Number.isNaN(date.getTime()) || toLocalDateTime(date.toISOString()) !== value) {
    throw new Error("Escolha uma data e hora local válida.");
  }
  // Newly entered ambiguous local times use the browser's earlier occurrence.
  return date.toISOString();
}
