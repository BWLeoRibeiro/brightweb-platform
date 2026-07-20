import type { HTMLAttributes } from "react";

import { cn } from "../lib/utils";

export type SurfaceCardProps = HTMLAttributes<HTMLElement> & {
  isLight?: boolean;
};

export function SurfaceCard({ isLight = false, className, ...props }: SurfaceCardProps) {
  return <article className={cn("surface-card", isLight && "is-light", className)} {...props} />;
}
