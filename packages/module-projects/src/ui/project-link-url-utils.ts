const URL_WITH_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

export function normalizeProjectLinkUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (URL_WITH_SCHEME_REGEX.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isValidProjectLinkUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
