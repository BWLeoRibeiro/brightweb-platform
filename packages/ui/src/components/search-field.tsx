"use client";

import { Search, X } from "lucide-react";

import { cn } from "../lib/utils";
import { Input } from "./input";

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  size?: "sm" | "md";
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
};

export function SearchField({
  value,
  onChange,
  placeholder = "Search…",
  onClear,
  size = "md",
  className,
  inputClassName,
  autoFocus,
  "aria-label": ariaLabel,
}: SearchFieldProps) {
  const showClear = Boolean(onClear) && value.length > 0;

  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          size === "sm" ? "h-8" : "h-9",
          "rounded-[var(--radius-card)] border-border bg-card pl-8 text-ui-meta text-foreground",
          showClear ? "pr-8" : null,
          inputClassName,
        )}
      />
      {showClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear"
          className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export type { SearchFieldProps };
