export function resolveProjectCreationIntent(href: string) {
  const url = new URL(href);
  if (url.searchParams.get("create") !== "project") {
    return { shouldOpen: false, nextHref: null } as const;
  }

  url.searchParams.delete("create");
  return {
    shouldOpen: true,
    nextHref: `${url.pathname}${url.search}${url.hash}`,
  } as const;
}
