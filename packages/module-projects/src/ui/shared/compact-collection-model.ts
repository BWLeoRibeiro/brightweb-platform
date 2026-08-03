export const COMPACT_COLLECTION_PREVIEW_LIMIT = 3;

export function getCompactCollectionPreview<T>(items: readonly T[]): T[] {
  return items.slice(0, COMPACT_COLLECTION_PREVIEW_LIMIT);
}

export function hasCompactCollectionOverflow(total: number): boolean {
  return total > COMPACT_COLLECTION_PREVIEW_LIMIT;
}
