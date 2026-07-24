import type { ComponentProps, ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../utils";

export type ProjectPillSize = "small" | "normal";
export type ProjectPillProps = Omit<ComponentProps<"span">, "children"> & {
  children: ReactNode;
  asChild?: boolean;
  dotClassName?: string;
  size?: ProjectPillSize;
};

export const PROJECT_PILL_BASE_CLASS =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border font-semibold leading-none";

export const PROJECT_PILL_SIZE_CLASSES: Record<ProjectPillSize, string> = {
  small: "h-5 px-2 text-[length:var(--text-ui-micro)]",
  normal: "h-7 px-3 text-[length:var(--text-ui-meta)]",
};

export function ProjectPill({
  children,
  asChild = false,
  dotClassName,
  className,
  size = "small",
  title,
  ...props
}: ProjectPillProps) {
  const Comp = asChild ? Slot : "span";

  if (asChild) {
    return (
      <Comp
        className={cn(PROJECT_PILL_BASE_CLASS, PROJECT_PILL_SIZE_CLASSES[size], className)}
        title={title}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      className={cn(PROJECT_PILL_BASE_CLASS, PROJECT_PILL_SIZE_CLASSES[size], className)}
      title={title}
      {...props}
    >
      {dotClassName ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClassName)} /> : null}
      {children}
    </Comp>
  );
}

export const ProjectDotPill = ProjectPill;
