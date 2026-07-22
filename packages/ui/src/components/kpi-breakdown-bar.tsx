"use client";

import type { CSSProperties } from "react";

import { cn } from "../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

export type KpiBreakdownItem = {
  label: string;
  tone: string;
  value: number;
};

export type KpiBreakdownBarProps = {
  items: KpiBreakdownItem[];
  toneTokens: Readonly<Record<string, string>>;
  className?: string;
};

function tokenStyle(token: string): CSSProperties {
  return { background: `var(${token})` };
}

export function KpiBreakdownBar({ items, toneTokens, className }: KpiBreakdownBarProps) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);

  return (
    <div className={cn("mt-5", className)}>
      <TooltipProvider delayDuration={80}>
        <div className="flex h-2 overflow-hidden rounded-full bg-elevate-3">
          {total > 0 ? items.map((item) => {
            const token = toneTokens[item.tone];
            if (item.value <= 0 || !token) return null;

            return (
              <Tooltip key={`${item.tone}:${item.label}`}>
                <TooltipTrigger asChild>
                  <span
                    className="h-full cursor-default transition-[filter] duration-150 first:rounded-l-full last:rounded-r-full hover:brightness-110"
                    style={{ ...tokenStyle(token), width: `${(item.value / total) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-[var(--radius-swatch)]" style={tokenStyle(token)} />
                    <span>{item.label}</span>
                    <span className="font-bold tabular-nums">{item.value}</span>
                  </span>
                </TooltipContent>
              </Tooltip>
            );
          }) : null}
        </div>
      </TooltipProvider>
      <div className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-1.5">
        {items.map((item) => {
          const token = toneTokens[item.tone];
          return (
            <div key={`${item.tone}:${item.label}`} className="flex items-center justify-between gap-2 text-ui-meta">
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span className="size-1.5 shrink-0 rounded-[var(--radius-swatch)]" style={token ? tokenStyle(token) : undefined} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-mono font-bold tabular-nums text-foreground">{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
