import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { portalCardTitleClassName } from "./typography";
import { cn } from "../utils";

type ProjectSurfaceCardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function ProjectSurfaceCard({ children, className, ...props }: ProjectSurfaceCardProps) {
  return (
    <article
      {...props}
      className={cn(
        "project-surface-card",
        className,
      )}
    >
      {children}
    </article>
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
        <h2 className={cn(portalCardTitleClassName, titleClassName)}>{title}</h2>
        {subtitle ? (
          <p className={cn("text-sm text-[color:var(--muted-foreground)]", subtitleClassName)}>{subtitle}</p>
        ) : null}
      </div>
      {rightSlot}
    </div>
  );
}
