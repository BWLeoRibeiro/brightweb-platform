import type { HTMLAttributes } from "react";

import { cn } from "../lib/utils";
import { Card, type CardProps } from "./card";

export type SurfaceCardProps = HTMLAttributes<HTMLElement> & {
  isLight?: boolean;
  variant?: CardProps["variant"];
  density?: CardProps["density"];
  motion?: CardProps["motion"];
};

export function SurfaceCard({
  isLight = false,
  variant,
  density = "default",
  motion = "enter",
  className,
  ...props
}: SurfaceCardProps) {
  return (
    <Card asChild variant={variant ?? (isLight ? "light" : "default")} density={density} motion={motion}>
      <article className={cn("surface-card", isLight && "is-light", className)} {...props} />
    </Card>
  );
}
