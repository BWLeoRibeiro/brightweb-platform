"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "../lib/utils";

export type PillTabItem<Value extends string> = {
  label: string;
  value: Value;
};

export type PillTabsProps<Value extends string> = {
  ariaLabel: string;
  className?: string;
  items: readonly PillTabItem<Value>[];
  onValueChange: (value: Value) => void;
  value: Value;
};

export function PillTabs<Value extends string>({
  ariaLabel,
  className,
  items,
  onValueChange,
  value,
}: PillTabsProps<Value>) {
  const prefersReducedMotion = useReducedMotion();
  const layoutScope = useId();
  const [hovered, setHovered] = useState<Value | null>(null);

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] p-1",
        className,
      )}
      onMouseLeave={() => setHovered(null)}
    >
      {items.map((item) => {
        const active = item.value === value;
        const isHovered = hovered === item.value && !active;

        return (
          <motion.button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(item.value)}
            onMouseEnter={() => setHovered(item.value)}
            onFocus={() => setHovered(item.value)}
            onBlur={() => setHovered(null)}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 32 }}
            className="relative min-h-11 shrink-0 rounded-full px-4 py-1.5 text-body text-[length:var(--text-ui-action)] font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] motion-reduce:transition-none"
            style={{
              color: active
                ? "var(--foreground-button-brand)"
                : isHovered
                  ? "var(--foreground)"
                  : "var(--muted-foreground)",
            }}
          >
            {isHovered ? (
              <motion.span
                layoutId={prefersReducedMotion ? undefined : `${layoutScope}-hover`}
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--dashboard-tab-hover)" }}
                transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 38 }}
              />
            ) : null}
            {active ? (
              <motion.span
                layoutId={prefersReducedMotion ? undefined : `${layoutScope}-active`}
                aria-hidden
                className="absolute inset-0 rounded-full shadow-[var(--dashboard-tab-shadow)]"
                style={{ background: "var(--surface-button-brand)" }}
                transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative z-10">{item.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
