import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/utils";

export const actionClassName =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-[color:var(--brand-accent)] bg-[color:var(--brand-accent)] px-3.5 py-1.5 text-ui-meta font-semibold text-[color:var(--accent-foreground)] transition-colors hover:bg-[color:var(--brand-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5";

export type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function ActionButton({ className, type = "button", ...props }: ActionButtonProps) {
  return <button type={type} className={cn(actionClassName, className)} {...props} />;
}
