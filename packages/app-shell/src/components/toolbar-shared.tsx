"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown, ListFilter, RotateCcw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@brightweblabs/ui/dropdown-menu";
import { Input } from "@brightweblabs/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@brightweblabs/ui/tooltip";
import { cn } from "../lib/utils";

type NewMenuItem = {
  label: string;
  onSelect: () => void;
};

type ToolbarNewMenuProps = {
  id: string;
  icon: LucideIcon;
  label?: string;
  tooltip: string;
  items: NewMenuItem[];
};

export function ToolbarNewMenu({ id, icon: Icon, label = "Novo", tooltip, items }: ToolbarNewMenuProps) {
  return (
    <Tooltip>
      <DropdownMenu>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              id={id}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/12 bg-white/95 px-3 py-2 text-xs font-medium text-foreground/75 transition-colors hover:border-black/20 hover:text-foreground dark:border-white/12 dark:bg-black/65 dark:hover:border-white/25"
            >
              <Icon className="size-3.5" />
              {label}
              <ChevronDown className="size-3.5 opacity-70" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <DropdownMenuContent align="start" className="w-fit min-w-0 whitespace-nowrap">
          {items.map((item) => (
            <DropdownMenuItem key={item.label} className="whitespace-nowrap" onClick={item.onSelect}>
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

type ToolbarFilterToggleProps = {
  expanded: boolean;
  onToggle: () => void;
};

export function ToolbarFilterToggle({ expanded, onToggle }: ToolbarFilterToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/12 bg-white/95 text-foreground/75 transition-colors hover:border-black/20 hover:text-foreground dark:border-white/12 dark:bg-black/65 dark:hover:border-white/25",
            expanded && "hidden",
          )}
          aria-label={expanded ? "Colapsar filtros" : "Expandir filtros"}
        >
          <ListFilter className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{expanded ? "Colapsar filtros" : "Expandir filtros"}</TooltipContent>
    </Tooltip>
  );
}

type ToolbarFiltersPillProps = {
  expanded: boolean;
  onCollapse: () => void;
  children: React.ReactNode;
};

export function ToolbarFiltersPill({ expanded, onCollapse, children }: ToolbarFiltersPillProps) {
  return (
    <div
      className={cn(
        "hidden items-center gap-1.5 rounded-full border border-black/12 bg-white/95 p-1.5 pl-1.5 xl:gap-2 xl:pl-2 dark:border-white/12 dark:bg-black/65",
        expanded ? "lg:flex" : "hidden",
      )}
    >
      {expanded ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onCollapse}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/12 bg-white/95 text-foreground/75 transition-colors hover:border-black/20 hover:text-foreground dark:border-white/12 dark:bg-black/65 dark:hover:border-white/25"
              aria-label="Colapsar filtros"
            >
              <ListFilter className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Colapsar filtros</TooltipContent>
        </Tooltip>
      ) : null}
      {children}
    </div>
  );
}

type ToolbarDropdownChipProps = {
  id: string;
  icon: LucideIcon;
  label: string;
  tooltip: string;
  items: Array<{ key: string; label: string; onSelect: () => void }>;
};

export function ToolbarDropdownChip({ id, icon: Icon, label, tooltip, items }: ToolbarDropdownChipProps) {
  return (
    <Tooltip>
      <DropdownMenu>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              id={id}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/3 px-3 py-1.5 text-xs font-medium text-foreground/75 transition-colors hover:border-black/20 hover:bg-black/7 hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:hover:border-white/25 dark:hover:bg-white/10 whitespace-nowrap"
            >
              <Icon className="size-3.5" />
              {label}
              <ChevronDown className="size-3.5 opacity-70" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <DropdownMenuContent align="start" className="w-fit min-w-0 whitespace-nowrap">
          {items.map((item) => (
            <DropdownMenuItem key={item.key} onClick={item.onSelect}>
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

type ToolbarSearchRefreshPillProps = {
  searchValue: string;
  onSearchChange: (next: string) => void;
  placeholder?: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  refreshTooltip: string;
  refreshAriaLabel: string;
};

export function ToolbarSearchRefreshPill({
  searchValue,
  onSearchChange,
  placeholder = "Pesquisar",
  isRefreshing,
  onRefresh,
  refreshTooltip,
  refreshAriaLabel,
}: ToolbarSearchRefreshPillProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-black/12 bg-white/95 p-1.5 pl-1.5 xl:gap-2 xl:pl-2 dark:border-white/12 dark:bg-black/65">
      <Input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 w-40 border-transparent bg-transparent text-xs shadow-none focus-visible:ring-0 xl:w-56"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={refreshAriaLabel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-black/3 text-foreground/75 transition-colors hover:border-black/20 hover:bg-black/7 hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:hover:border-white/25 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className={cn(isRefreshing && "animate-spin [animation-direction:reverse]")}>
              <RotateCcw className="size-3.5" />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent>{refreshTooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}
