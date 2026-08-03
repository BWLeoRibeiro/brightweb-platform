import type { ReactNode } from "react";
import { Expand } from "lucide-react";
import { Badge, Skeleton, TooltipProvider } from "@brightweblabs/ui";
import { SectionIconButton } from "./section-icon-button";
import { ProjectSurfaceCard } from "./project-surface-card";
import { defaultProjectsUiDictionary } from "../dictionary";
import {
  COMPACT_COLLECTION_PREVIEW_LIMIT,
  hasCompactCollectionOverflow,
} from "./compact-collection-model";

export { COMPACT_COLLECTION_PREVIEW_LIMIT } from "./compact-collection-model";

export const compactCollectionRevealClassName =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200";

const countBadgeClassName =
  "h-5 min-w-5 justify-center rounded-full border-border-hairline-soft bg-transparent px-1.5 text-micro font-normal text-[color:var(--muted-foreground)]";

export function CompactCollectionHeaderActions({
  total,
  collectionLabel,
  expandLabel,
  onExpand,
  children,
}: {
  total: number;
  collectionLabel: string;
  expandLabel: string;
  onExpand: () => void;
  children?: ReactNode;
}) {
  const hasOverflow = hasCompactCollectionOverflow(total);
  if (!hasOverflow && !children) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        {hasOverflow ? (
          <>
            <Badge
              variant="outline"
              className={countBadgeClassName}
              aria-label={`${total} ${collectionLabel}`}
            >
              {total}
            </Badge>
            <SectionIconButton icon={Expand} label={expandLabel} onClick={onExpand} />
          </>
        ) : null}
        {children}
      </div>
    </TooltipProvider>
  );
}

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
