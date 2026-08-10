import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { Card } from "@brightweblabs/ui";
import { canonicalTitleClassName } from "./typography";
import { cn } from "../utils";

type ProjectSurfaceCardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  variant?: "default" | "light";
};

export function ProjectSurfaceCard({ children, className, variant = "default", ...props }: ProjectSurfaceCardProps) {
  return (
    <Card asChild variant={variant} density="default" motion="enter">
      <article {...props} className={cn("project-surface-card", className)}>
        {children}
      </article>
    </Card>
  );
}

type ProjectSurfaceSectionHeaderProps = {
  icon: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  iconWrapClassName?: string;
  iconClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  rightSlot?: ReactNode;
};

export function ProjectSurfaceSectionHeader({
  icon: Icon,
  title,
  subtitle,
  iconWrapClassName,
  iconClassName,
  titleClassName,
  subtitleClassName,
  rightSlot,
}: ProjectSurfaceSectionHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("project-section-icon", iconWrapClassName)}>
        <Icon className={cn("size-3.5", iconClassName)} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className={cn(canonicalTitleClassName, titleClassName)}>{title}</h2>
        {subtitle ? (
          <p className={cn("text-body text-[color:var(--muted-foreground)]", subtitleClassName)}>{subtitle}</p>
        ) : null}
      </div>
      {rightSlot}
    </div>
  );
}
