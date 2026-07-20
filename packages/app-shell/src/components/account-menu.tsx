import Link from "next/link";
import { BookOpen, House, LayoutDashboard, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@brightweblabs/ui/dropdown-menu";
import type { AccountMenuProps } from "../types";

export function AccountMenu({ displayName, isStaff, onSignOut, user, userInitials }: AccountMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          id="header-account-menu-trigger"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-primary transition-colors hover:bg-elevate-3"
          aria-label="Menu da conta"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">{userInitials}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-fit min-w-0 whitespace-nowrap">
        <DropdownMenuLabel className="font-normal space-y-0.5">
          {displayName ? (
            <p className="text-ui-body truncate font-semibold text-foreground" title={displayName}>
              Olá, {displayName}
            </p>
          ) : null}
          <p className="text-ui-meta truncate text-muted-foreground" title={user?.email ?? undefined}>
            {user?.email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isStaff ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="size-4" />
                Painel de Controlo
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account" className="flex items-center gap-2">
                <User className="size-4" />
                A Minha Conta
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link href="/account" className="flex items-center gap-2">
                <LayoutDashboard className="size-4" />O meu painel
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/courses" className="flex items-center gap-2">
                <BookOpen className="size-4" />
                Os meus cursos
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/settings" className="flex items-center gap-2">
                <User className="size-4" />
                Definicoes da conta
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/" className="flex items-center gap-2">
            <House className="size-4" />
            Site principal
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onSignOut} className="gap-2">
          <LogOut className="size-4" />
          Terminar Sessao
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
