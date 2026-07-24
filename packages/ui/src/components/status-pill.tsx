"use client";

import { Slot } from "@radix-ui/react-slot";
import { tintPill } from "@brightweblabs/theme/tint";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

import { cn } from "../lib/utils";

export type StatusPillSize = "small" | "normal";

export const STATUS_PILL_BASE_CLASS =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border font-semibold leading-none";

export const STATUS_PILL_SIZE_CLASSES: Record<StatusPillSize, string> = {
  small: "h-5 px-2 text-ui-micro",
  normal: "h-7 px-3 text-ui-meta",
};

export type StatusPillProps = Omit<ComponentProps<"span">, "children"> & {
  children: ReactNode;
  token: string;
  size?: StatusPillSize;
  asChild?: boolean;
};

export function StatusPill({ children, token, size = "small", asChild = false, className, style, ...props }: StatusPillProps) {
  const Comp = asChild ? Slot : "span";
  const tint = tintPill(token);

  return (
    <Comp
      className={cn(STATUS_PILL_BASE_CLASS, STATUS_PILL_SIZE_CLASSES[size], tint.className, className)}
      style={{ ...tint.style, ...style } as CSSProperties}
      {...props}
    >
      {children}
    </Comp>
  );
}
