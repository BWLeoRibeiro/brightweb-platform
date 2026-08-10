"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown, ListFilter, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@brightweblabs/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@brightweblabs/ui/dropdown-menu";
import { Input } from "@brightweblabs/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@brightweblabs/ui/tooltip";
import { cn } from "../lib/utils";

export type ToolbarSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  clearLabel?: string;
  className?: string;
};

/** Shared responsive toolbar search with an accessible inline clear action. */
export function ToolbarSearchField({
  value,
  onChange,
  placeholder,
  disabled = false,
  clearLabel = "Limpar pesquisa",
  className,
}: ToolbarSearchFieldProps) {
  return (
    <div className={cn(
      "relative inline-flex h-9 min-w-[min(var(--toolbar-search-min-width),72vw)] flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-[color:var(--muted-foreground)] sm:min-w-[var(--toolbar-search-min-width)] sm:flex-none",
      className,
    )}>
      <Search className="size-[var(--toolbar-icon-size)] shrink-0" aria-hidden />
      <Input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-body text-[length:var(--text-ui-action)] text-[color:var(--foreground)] shadow-none focus-visible:ring-0",
          value ? "pr-6" : undefined,
        )}
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={disabled}
          aria-label={clearLabel}
          className="absolute right-2 rounded-full text-[color:var(--muted-foreground)]"
          onClick={() => onChange("")}
        >
          <X aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

type NewMenuItem = {
  icon?: LucideIcon;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
};

type ToolbarNewMenuProps = {
  id: string;
  icon: LucideIcon;
  label?: string;
  tooltip: string;
  items: NewMenuItem[];
  disabled?: boolean;
};

export function ToolbarNewMenu({ id, icon: Icon, label = "Novo", tooltip, items, disabled = false }: ToolbarNewMenuProps) {
  return (
    <Tooltip>
      <DropdownMenu>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="brand"
              id={id}
              disabled={disabled}
            >
              <Icon data-icon="inline-start" />
              {label}
              <ChevronDown data-icon="inline-end" className="opacity-70" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <DropdownMenuContent align="end" className="w-52 border-[color:var(--hairline)] bg-[color:var(--popover)]">
          {items.map((item) => (
            <DropdownMenuItem key={item.label} className="whitespace-nowrap" disabled={item.disabled} onClick={item.onSelect}>
              {item.icon ? <item.icon className="size-4" /> : null}
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
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={onToggle}
          className={cn(
            "rounded-full text-foreground/75",
            expanded && "hidden",
          )}
          aria-label={expanded ? "Colapsar filtros" : "Expandir filtros"}
        >
          <ListFilter />
        </Button>
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
        "hidden items-center gap-1.5 rounded-full border border-hairline-strong bg-popover p-1.5 pl-1.5 xl:gap-2 xl:pl-2",
        expanded ? "lg:flex" : "hidden",
      )}
    >
      {expanded ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onCollapse}
              className="rounded-full text-foreground/75"
              aria-label="Colapsar filtros"
            >
              <ListFilter />
            </Button>
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
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline bg-elevate-1 px-3 py-1.5 text-meta font-semibold text-foreground/75 transition-colors hover:border-hairline-strong hover:bg-elevate-3 hover:text-foreground"
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
    <div className="flex items-center gap-1.5 rounded-full border border-hairline-strong bg-popover p-1.5 pl-1.5 xl:gap-2 xl:pl-2">
      <Input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 w-40 border-transparent bg-transparent text-meta shadow-none focus-visible:ring-0 xl:w-56"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={refreshAriaLabel}
            className="rounded-full text-foreground/75"
          >
            <div className={cn(isRefreshing && "animate-spin [animation-direction:reverse]")}>
              <RotateCcw />
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{refreshTooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}
