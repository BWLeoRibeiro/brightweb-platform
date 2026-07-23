import Link from "next/link";
import { ChevronDown, FolderKanban, House, LayoutDashboard, LogOut, Moon, Sun, SunMoon, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@brightweblabs/ui/dropdown-menu";
import { cn } from "../lib/utils";
import type { AccountMenuProps } from "../types";

function avatarRoleClass(role: "team" | "client") {
  return role === "team"
    ? "bg-[color:var(--surface-account-team)] text-[color:var(--role-team-strong)]"
    : "bg-[color:var(--surface-account-client)] text-[color:var(--role-client-strong)]";
}

export function AccountMenu({
  displayName,
  isStaff,
  onSignOut,
  onThemeChange,
  user,
  userInitials,
  variant = "header",
  collapsed = false,
  links,
}: AccountMenuProps) {
  const compactLabel = displayName?.trim().split(/\s+/)[0] || user?.email || "Conta";
  const isRail = variant === "rail";
  const secondaryLabel = user?.email ?? (isStaff ? "Administrador" : "Conta");
  const avatarTone = avatarRoleClass(isStaff ? "team" : "client");
  const hrefs = {
    staffDashboard: links?.staffDashboard ?? "/dashboard",
    account: links?.account ?? "/account",
    projects: links?.projects ?? "/account/projetos",
    home: links?.home ?? "/",
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {isRail ? (
          <button
            id="rail-account-menu-trigger"
            className={collapsed
              ? "flex items-center justify-center rounded-full p-2xs text-foreground/80 transition-colors hover:bg-[color:var(--surface-account-hover)]"
              : "flex w-full items-center gap-[var(--shell-account-gap)] rounded-xl border border-transparent bg-[color:var(--surface-account)] px-xs py-[var(--shell-account-padding-y)] text-left transition-colors hover:border-[color:var(--border)] hover:bg-[color:var(--surface-account-hover)]"}
            aria-label="Menu da conta"
          >
            <span className="relative inline-flex shrink-0">
              <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full text-[length:var(--text-ui-action)] font-extrabold", avatarTone)}>
                {userInitials || <User className="size-4" />}
              </span>
              <span className="absolute -bottom-px -right-px size-[var(--account-presence-size)] rounded-full border-2 border-[color:var(--card)] bg-[color:var(--account-presence)]" />
            </span>
            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[length:var(--text-ui-action)] font-bold leading-tight text-[color:var(--foreground)]" title={displayName ?? undefined}>{displayName}</span>
                  <span className="block truncate text-[length:var(--text-ui-label)] leading-tight text-[color:var(--muted-foreground)]" title={secondaryLabel}>{secondaryLabel}</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-foreground/45" />
              </>
            ) : null}
          </button>
        ) : (
          <button id="header-account-menu-trigger" className="inline-flex items-center gap-xs rounded-full px-2xs.5 pr-xs text-foreground/80 transition-colors hover:bg-[color:var(--surface-account-hover)] hover:text-foreground" aria-label="Menu da conta">
            <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full text-[length:var(--text-ui-label)] font-semibold", avatarTone)}>{userInitials || <User className="size-3.5" />}</span>
            <span className="hidden max-w-[7rem] truncate text-[length:var(--text-ui-meta)] font-semibold leading-none text-[color:var(--foreground)] xl:inline">{compactLabel}</span>
            <ChevronDown className="hidden size-3.5 text-foreground/45 xl:block" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isRail ? "start" : "end"}
        side={isRail ? "top" : "bottom"}
        sideOffset={isRail ? 8 : 4}
        className={cn("min-w-0 border-[color:var(--hairline)] bg-[color:var(--popover)]", isRail && !collapsed ? "w-[var(--radix-dropdown-menu-trigger-width)]" : "w-fit whitespace-nowrap")}
      >
        <DropdownMenuLabel className="space-y-0.5 font-normal">
          {displayName ? <p className="paragraph-small truncate font-semibold text-foreground" title={displayName}>Olá, {displayName}</p> : null}
          <p className="paragraph-mini truncate text-muted-foreground" title={user?.email ?? undefined}>{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isStaff ? (
          <>
            <DropdownMenuItem asChild><Link href={hrefs.staffDashboard} prefetch={false} className="flex items-center gap-xs"><LayoutDashboard className="size-4" />Painel de Controlo</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href={hrefs.account} prefetch={false} className="flex items-center gap-xs"><User className="size-4" />A Minha Conta</Link></DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild><Link href={hrefs.account} prefetch={false} className="flex items-center gap-xs"><LayoutDashboard className="size-4" />O meu painel</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href={hrefs.projects} prefetch={false} className="flex items-center gap-xs"><FolderKanban className="size-4" />Os meus projetos</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href={hrefs.account} prefetch={false} className="flex items-center gap-xs"><User className="size-4" />Dados da conta</Link></DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem asChild><Link href={hrefs.home} prefetch={false} className="flex items-center gap-xs"><House className="size-4" />Site principal</Link></DropdownMenuItem>
        {onThemeChange ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-xs"><SunMoon className="size-4" />Tema</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="border-[color:var(--hairline)] bg-[color:var(--popover)]">
                <DropdownMenuItem onClick={() => onThemeChange("light")} className="gap-xs"><Sun className="size-4" />Claro</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onThemeChange("dark")} className="gap-xs"><Moon className="size-4" />Escuro</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onThemeChange("system")} className="gap-xs"><SunMoon className="size-4" />Sistema</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onSignOut} className="gap-xs"><LogOut className="size-4" />Terminar Sessao</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
