"use client";

import * as React from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "../lib/utils";
import { buttonVariants, type ButtonVariantProps } from "./button-variants";

type ButtonProps = React.ComponentProps<"button"> &
  ButtonVariantProps & {
    asChild?: boolean;
    href?: string;
    prefetch?: React.ComponentProps<typeof Link>["prefetch"];
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, href, prefetch, ...props }, ref) => {
    const { onClick, onMouseEnter, onMouseLeave, onFocus, onBlur, children, ...restProps } = props;
    const hasCornerMotion = !asChild && variant === "accent";
    const [isActive, setIsActive] = React.useState(false);
    const borderSize = hasCornerMotion && isActive ? "100%" : "30%";
    const resolvedClassName = cn(buttonVariants({ variant, size, className }));

    const activate = () => hasCornerMotion && setIsActive(true);
    const deactivate = () => hasCornerMotion && setIsActive(false);

    const content = hasCornerMotion ? (
      <>
        <span className="relative z-2">{children}</span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 border-r border-t border-[color:var(--brand-accent)] transition-[width,height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ width: borderSize, height: borderSize }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 border-b border-l border-[color:var(--brand-accent)] transition-[width,height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ width: borderSize, height: borderSize }}
        />
      </>
    ) : children;

    if (!asChild && href) {
      return (
        <Link
          href={href}
          data-slot="button"
          data-variant={variant}
          data-size={size}
          className={resolvedClassName}
          prefetch={prefetch}
          onClick={onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined}
          onMouseEnter={(event) => {
            activate();
            onMouseEnter?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
          }}
          onMouseLeave={(event) => {
            deactivate();
            onMouseLeave?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
          }}
          onFocus={(event) => {
            activate();
            onFocus?.(event as unknown as React.FocusEvent<HTMLButtonElement>);
          }}
          onBlur={(event) => {
            deactivate();
            onBlur?.(event as unknown as React.FocusEvent<HTMLButtonElement>);
          }}
          {...(restProps as Omit<React.ComponentProps<typeof Link>, "href" | "prefetch">)}
        >
          {content}
        </Link>
      );
    }

    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={resolvedClassName}
        onClick={onClick}
        onMouseEnter={(event) => {
          activate();
          onMouseEnter?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
        }}
        onMouseLeave={(event) => {
          deactivate();
          onMouseLeave?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
        }}
        onFocus={(event) => {
          activate();
          onFocus?.(event as unknown as React.FocusEvent<HTMLButtonElement>);
        }}
        onBlur={(event) => {
          deactivate();
          onBlur?.(event as unknown as React.FocusEvent<HTMLButtonElement>);
        }}
        {...restProps}
      >
        {content}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps, ButtonVariantProps };
