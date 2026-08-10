import { Skeleton } from "@brightweblabs/ui";
import { defaultProjectsUiDictionary } from "../dictionary";
import { ProjectSurfaceCard } from "./project-surface-card";

export function CompactCollectionContentSkeleton() {
  return (
    <div className="mt-4 rounded-[var(--radius-card)] border border-[color:var(--border)] p-3" aria-hidden="true">
      <div className="flex min-h-[3.25rem] items-center gap-3">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-2.5 w-2/5" />
        </div>
      </div>
    </div>
  );
}

export function CompactCollectionCardSkeleton() {
  return (
    <ProjectSurfaceCard className="self-start" aria-busy="true" aria-label={defaultProjectsUiDictionary.detail.loading}>
      <Skeleton className="h-10" />
      <CompactCollectionContentSkeleton />
    </ProjectSurfaceCard>
  );
}
