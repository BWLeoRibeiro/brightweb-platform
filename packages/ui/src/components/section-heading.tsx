import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";

export type SectionHeadingProps = HTMLAttributes<HTMLDivElement> & {
  icon: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export function SectionHeading({ icon: Icon, title, subtitle, action, className, ...props }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)} {...props}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="section-icon mt-0.5" aria-hidden="true">
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-ui-panel-title">{title}</h2>
          {subtitle ? <p className="mt-1 text-ui-body text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
