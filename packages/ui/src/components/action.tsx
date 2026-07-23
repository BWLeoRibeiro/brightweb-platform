import type { ButtonHTMLAttributes } from "react";

import { buttonVariants } from "./button-variants";
import { cn } from "../lib/utils";

export const actionClassName =
  buttonVariants({ variant: "brand", size: "sm", className: "gap-1.5 rounded-full px-3.5 text-ui-meta [&_svg]:size-3.5" });

export type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function ActionButton({ className, type = "button", ...props }: ActionButtonProps) {
  return <button type={type} className={cn(actionClassName, className)} {...props} />;
}
