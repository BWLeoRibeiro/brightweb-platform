import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full border text-sm font-medium transition duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[color:var(--foreground)] text-[color:var(--background)] shadow-[0_18px_40px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:bg-[color:var(--accent)]",
        secondary:
          "border-[color:var(--border)] bg-[color:var(--panel)] text-[color:var(--foreground)] hover:-translate-y-0.5 hover:border-[color:var(--accent)] hover:bg-white/80",
        ghost:
          "border-transparent bg-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
      },
      size: {
        default: "h-11 px-5",
        lg: "h-12 px-6 text-[0.95rem]",
        sm: "h-9 px-4 text-xs uppercase tracking-[0.22em]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

function ButtonLink({
  href,
  className,
  variant,
  size,
  children,
}: React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size, className }))}>
      {children}
    </Link>
  );
}

export { Button, ButtonLink, buttonVariants };
