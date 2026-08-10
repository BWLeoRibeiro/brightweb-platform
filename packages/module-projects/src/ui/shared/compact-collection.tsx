"use client";

import type { ReactNode } from "react";
import { Expand } from "lucide-react";
import { Badge, TooltipProvider } from "@brightweblabs/ui";
import { SectionIconButton } from "./section-icon-button";
import {
  hasCompactCollectionOverflow,
} from "./compact-collection-model";

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
