import type { ComponentProps } from "react";

import { getInitials } from "../lib/patterns";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback } from "./avatar";

export type InitialsAvatarTone = "active" | "subtle";

export type InitialsAvatarProps = Omit<ComponentProps<typeof Avatar>, "children"> & {
  label?: string | null;
  fallback?: string | null;
  tone?: InitialsAvatarTone;
};

const toneClasses: Record<InitialsAvatarTone, string> = {
  active: "bg-primary/15 text-primary",
  subtle: "bg-muted text-muted-foreground",
};

export function InitialsAvatar({ label, fallback, tone = "active", className, ...props }: InitialsAvatarProps) {
  return (
    <Avatar className={cn("shrink-0", toneClasses[tone], className)} {...props}>
      <AvatarFallback className="bg-transparent text-ui-meta font-bold uppercase text-current">
        {getInitials(label, fallback)}
      </AvatarFallback>
    </Avatar>
  );
}

export { getInitials } from "../lib/patterns";
