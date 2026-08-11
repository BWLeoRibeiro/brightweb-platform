import type { ProjectClientAccessMode } from "./contracts";

export function hasSelectedClientOrganizationWithoutAudience(
  mode: ProjectClientAccessMode,
  organizations: ReadonlyArray<{ selectedProfileIds: readonly string[] }>,
): boolean {
  return mode === "selected_clients"
    && organizations.some((organization) => organization.selectedProfileIds.length === 0);
}
