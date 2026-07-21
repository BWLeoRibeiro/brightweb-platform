import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";

export type StatTileProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
};

export function StatTile({ label, children, className, ...props }: StatTileProps) {
  return (
    <div className={cn("stat-cell", className)} {...props}>
      <p className="text-ui-label">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export type StatValueProps = HTMLAttributes<HTMLParagraphElement> & {
  size?: "normal" | "large" | "display";
};

const statValueSizeClasses: Record<NonNullable<StatValueProps["size"]>, string> = {
  normal: "text-ui-metric",
  large: "text-ui-metric-xl",
  display: "text-ui-metric-display",
};

export function StatValue({ size = "normal", className, ...props }: StatValueProps) {
  return <p className={cn(statValueSizeClasses[size], className)} {...props} />;
}
