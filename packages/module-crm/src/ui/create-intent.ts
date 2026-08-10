export type CrmCreateIntent = "contact" | "organization";

export function consumeCrmCreateIntent(currentHref: string, intent: CrmCreateIntent) {
  const url = new URL(currentHref, "http://localhost");
  if (url.searchParams.get("create") !== intent) return null;
  url.searchParams.delete("create");
  return `${url.pathname}${url.search}${url.hash}`;
}
