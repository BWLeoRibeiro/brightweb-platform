"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "../lib/utils";
import { Input } from "./input";

interface PasswordInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  showToggle?: boolean;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({
    className,
    disabled,
    showToggle = true,
    showPasswordLabel = "Show password",
    hidePasswordLabel = "Hide password",
    ...props
  }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    return (
      <div className="relative w-full">
        <Input type={showPassword ? "text" : "password"} className={cn(showToggle && "pr-12", className)} disabled={disabled} ref={ref} {...props} />
        {showToggle ? (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius)] text-foreground/40 transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled}
            aria-label={showPassword ? hidePasswordLabel : showPasswordLabel}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        ) : null}
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
export type { PasswordInputProps };
