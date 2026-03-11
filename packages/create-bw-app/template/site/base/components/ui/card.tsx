import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"article">) {
  return (
    <article
      className={cn(
        "rounded-[28px] border border-[color:var(--border)] bg-[color:var(--panel)] shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 sm:p-7", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("font-display text-2xl tracking-[-0.03em] text-[color:var(--foreground)]", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm leading-7 text-[color:var(--muted-foreground)]", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardTitle };
