import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";

export type CoverHeaderProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  coverClassName?: string;
  contentClassName?: string;
};

export function CoverHeader({
  children,
  className,
  coverClassName,
  contentClassName,
  ...props
}: CoverHeaderProps) {
  return (
    <header
      className={cn(
        "overflow-hidden rounded-[var(--radius-panel)] border border-border/60 bg-card shadow-[var(--cover-header-shadow)]",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className={cn("relative h-24 overflow-hidden sm:h-32", coverClassName)}
        style={{ background: "var(--cover-header-surface)" }}
      >
        <span className="absolute -right-16 -top-24 size-72 rounded-full" style={{ background: "var(--cover-header-glow-strong)" }} />
        <span className="absolute -bottom-24 left-[12%] size-56 rounded-full" style={{ background: "var(--cover-header-glow-soft)" }} />
      </div>
      <div className={cn("relative px-5 pb-6 sm:px-8 sm:pb-8", contentClassName)}>
        {children}
      </div>
    </header>
  );
}
