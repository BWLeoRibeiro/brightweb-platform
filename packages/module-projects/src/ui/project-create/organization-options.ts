export type ProjectOrganizationOption = {
  id: string;
  name: string;
};

export function upsertOrganizationOption(
  current: ProjectOrganizationOption[],
  created: ProjectOrganizationOption,
): ProjectOrganizationOption[] {
  return [...current.filter((organization) => organization.id !== created.id), created]
    .toSorted((left, right) => left.name.localeCompare(right.name, "pt-PT"));
}

export function reconcileLoadedOrganizationOptions(
  loaded: ProjectOrganizationOption[],
  latestCreated: ProjectOrganizationOption | null,
): ProjectOrganizationOption[] {
  return latestCreated ? upsertOrganizationOption(loaded, latestCreated) : loaded;
}
