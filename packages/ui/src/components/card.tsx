"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const cardVariants = cva("card-root flex flex-col text-card-foreground", {
  variants: {
    variant: {
      default: "",
      light: "",
      elevated: "",
      interactive: "",
      /** Insight/blog card: the canonical borderless media-card treatment. */
      insight: "",
    },
    density: {
      none: "",
      compact: "p-3",
      default: "p-5",
    },
    motion: {
      none: "",
      enter: "card-enter",
    },
  },
  defaultVariants: {
    variant: "default",
    density: "none",
    motion: "none",
  },
});

export type CardProps = React.ComponentProps<"div"> & VariantProps<typeof cardVariants> & {
  asChild?: boolean;
};

function Card({
  asChild = false,
  className,
  variant = "default",
  density = "none",
  motion = "none",
  ...props
}: CardProps) {
  const Component = asChild ? Slot : "div";

  return (
    <Component
      data-slot="card"
      data-variant={variant}
      data-density={density}
      data-motion={motion}
      className={cn(cardVariants({ variant, density, motion, className }))}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("leading-none font-semibold", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-muted-foreground text-body", className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn(className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center [.border-t]:pt-6", className)} {...props} />;
}

export { Card, cardVariants, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
