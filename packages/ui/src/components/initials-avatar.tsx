import type { ComponentProps } from "react";

import { getInitials } from "../lib/patterns";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback } from "./avatar";

export type InitialsAvatarTone = "active" | "subtle" | "client" | "team" | "inverse";

export type InitialsAvatarProps = Omit<ComponentProps<typeof Avatar>, "children"> & {
  label?: string | null;
  fallback?: string | null;
  tone?: InitialsAvatarTone;
};

const toneClasses: Record<InitialsAvatarTone, string> = {
  active: "bg-primary/15 text-primary",
  subtle: "bg-muted text-muted-foreground",
  client: "bg-[color:var(--surface-account-client)] text-[color:var(--role-client-strong)]",
  team: "bg-[color:var(--surface-account-team)] text-[color:var(--role-team-strong)]",
  inverse: "bg-[color:var(--brand-panel-foreground)] text-[color:var(--project-hero-base)] ring-1 ring-[color:var(--brand-panel-border)]",
};

export function InitialsAvatar({ label, fallback, tone = "active", className, ...props }: InitialsAvatarProps) {
  return (
    <Avatar className={cn("shrink-0", toneClasses[tone], className)} {...props}>
      <AvatarFallback className="bg-transparent text-meta font-bold text-current">
        {getInitials(label, fallback)}
      </AvatarFallback>
    </Avatar>
  );
}

export { getInitials } from "../lib/patterns";
