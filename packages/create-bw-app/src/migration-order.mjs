// Inputs are grouped in dependency order. Stable sorting keeps that order for
// equal timestamps, while later cross-module changes run after earlier baselines.
// Only fresh assemblies use this; existing numbered history is immutable.
export function orderFreshMigrationSources(sources) {
  return [...sources].sort((left, right) =>
    left.fileName.split("_")[0].localeCompare(right.fileName.split("_")[0]),
  );
}
