import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  icon: LucideIcon;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, hint, action, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)} {...props}>
      <div className="flex size-11 items-center justify-center rounded-lg border border-hairline bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <p className="text-ui-body font-semibold text-foreground">{title}</p>
        {hint ? <p className="mt-1 text-ui-meta text-muted-foreground">{hint}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
