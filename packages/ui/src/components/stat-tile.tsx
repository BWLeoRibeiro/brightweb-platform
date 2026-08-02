import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";

export type StatTileProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
};

export function StatTile({ label, children, className, ...props }: StatTileProps) {
  return (
    <div className={cn("stat-cell", className)} {...props}>
      <p className="text-label text-muted-foreground">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export type StatValueProps = HTMLAttributes<HTMLParagraphElement> & {
  size?: "normal" | "large" | "display";
};

const statValueSizeClasses: Record<NonNullable<StatValueProps["size"]>, string> = {
  normal: "text-kpi",
  large: "text-kpi-lg",
  display: "text-kpi",
};

export function StatValue({ size = "normal", className, ...props }: StatValueProps) {
  return <p className={cn(statValueSizeClasses[size], className)} {...props} />;
}
