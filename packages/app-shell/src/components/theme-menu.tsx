import { Moon, Sun, SunMoon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@brightweb/ui";
import type { ThemeMenuProps } from "../types";

export function ThemeMenu({ onThemeChange }: ThemeMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          id="header-theme-menu-trigger"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground/75 transition-colors hover:bg-black/6 hover:text-foreground dark:hover:bg-white/10"
          aria-label="Alterar tema"
        >
          <span className="relative inline-flex items-center justify-center">
            <Sun className="size-4 dark:hidden" />
            <Moon className="hidden size-4 dark:block" />
            <SunMoon className="sr-only" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-fit min-w-0 whitespace-nowrap">
        <DropdownMenuItem onClick={() => onThemeChange("light")} className="gap-2">
          <Sun className="size-4" />
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onThemeChange("dark")} className="gap-2">
          <Moon className="size-4" />
          Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onThemeChange("system")} className="gap-2">
          <SunMoon className="size-4" />
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
