export type PaginationWindowItem = number | "start-ellipsis" | "end-ellipsis";

export function getPaginationWindow(page: number, totalPages: number): PaginationWindowItem[] {
  const safeTotal = Math.max(1, Math.trunc(totalPages));
  const safePage = Math.min(Math.max(Math.trunc(page), 1), safeTotal);

  if (safeTotal <= 5) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1);
  }

  const pages = new Set([1, safeTotal, safePage - 1, safePage, safePage + 1]);
  const visible = Array.from(pages).filter((value) => value >= 1 && value <= safeTotal).sort((a, b) => a - b);
  const result: PaginationWindowItem[] = [];

  visible.forEach((value, index) => {
    const previous = visible[index - 1];
    if (previous && value - previous > 1) {
      result.push(previous === 1 ? "start-ellipsis" : "end-ellipsis");
    }
    result.push(value);
  });

  return result;
}

export function getInitials(label?: string | null, fallback?: string | null): string {
  const source = (label || fallback || "?").trim();
  if (!source) return "?";

  return source
    .split(/\s+/)
    .map((token) => token.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function getRoleLabel(role: string): string {
  return role
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function resolveRoleToken(
  role: string,
  tokenMap: Readonly<Record<string, string>>,
  fallbackToken = "--semantic-neutral",
): string {
  return tokenMap[role] ?? fallbackToken;
}
