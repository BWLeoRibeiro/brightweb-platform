import type { ReactNode } from "react";
import { portalLabelClassName } from "./typography";
import { cn } from "../utils";

type ProjectOverviewStatCardProps = {
  title: string;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
};

export function ProjectOverviewStatCard({
  title,
  children,
  className,
  titleClassName,
  contentClassName,
}: ProjectOverviewStatCardProps) {
  return (
    <div className={className}>
      <p className={cn(portalLabelClassName, titleClassName)}>
        {title}
      </p>
      <div className={cn("mt-3", contentClassName)}>{children}</div>
    </div>
  );
}

type ProjectOverviewStatValueProps = {
  children: ReactNode;
  className?: string;
};

export function ProjectOverviewStatValue({ children, className }: ProjectOverviewStatValueProps) {
  return <p className={cn("text-[15px] font-semibold leading-snug tracking-tight text-[color:var(--foreground)] tabular-nums", className)}>{children}</p>;
}

type ProjectOverviewStatIconValueProps = {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ProjectOverviewStatIconValue({ icon, children, className }: ProjectOverviewStatIconValueProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {icon}
      <span className="text-[15px] font-semibold leading-snug tracking-tight text-[color:var(--foreground)]">{children}</span>
    </div>
  );
}

type ProjectOverviewStatMetaProps = {
  children: ReactNode;
  className?: string;
};

export function ProjectOverviewStatMeta({ children, className }: ProjectOverviewStatMetaProps) {
  return <p className={cn("mt-1 text-[11px] text-[color:var(--muted-foreground)]", className)}>{children}</p>;
}
