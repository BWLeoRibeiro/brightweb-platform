"use client";

import Image from "next/image";
import Link from "next/link";
import { BriefcaseBusiness, House, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import type { LayoutUser, ShellBrand } from "../types";
import { AccountMenu } from "./account-menu";

export type ClientPortalFrameProps = {
  brand: ShellBrand;
  children: ReactNode;
  pathname: string;
  displayName: string;
  user: LayoutUser;
  userInitials: string;
  onSignOut: () => Promise<void>;
};

const CLIENT_NAV_ITEMS = [
  { href: "/account", label: "O meu espaço", mobileLabel: "Início", icon: House, exact: true },
  { href: "/account/projetos", label: "Os meus projetos", mobileLabel: "Projetos", icon: BriefcaseBusiness, exact: false },
] as const;

function isClientNavItemActive(pathname: string, item: (typeof CLIENT_NAV_ITEMS)[number]) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ClientPortalFrame({
  brand,
  children,
  pathname,
  displayName,
  user,
  userInitials,
  onSignOut,
}: ClientPortalFrameProps) {
  return (
    <div className="min-h-dvh bg-background bg-[image:var(--page-background)] text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/88 shadow-[var(--dashboard-shadow-sm)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/78">
        <div className="mx-auto flex h-[4.5rem] max-w-[76rem] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link href="/account" prefetch={false} className="flex min-h-11 min-w-0 items-center gap-3" aria-label={brand.ariaLabel}>
            <Image
              src={brand.collapsedLogo.src}
              alt={brand.alt}
              width={brand.collapsedLogo.width}
              height={brand.collapsedLogo.height}
              className="size-9 shrink-0 object-contain"
              priority
            />
            <span className="hidden border-l border-border/65 pl-3 sm:block">
              <span className="block text-label font-bold">BrightWeb</span>
              <span className="block text-meta text-muted-foreground">Portal do cliente</span>
            </span>
          </Link>

          <nav className="hidden items-stretch self-stretch sm:flex" aria-label="Navegação do portal do cliente">
            {CLIENT_NAV_ITEMS.map((item) => {
              const active = isClientNavItemActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex items-center px-5 text-body font-semibold text-muted-foreground transition-colors hover:text-foreground",
                    active && "text-foreground after:absolute after:inset-x-5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <AccountMenu
            displayName={displayName}
            isStaff={false}
            onSignOut={onSignOut}
            user={user}
            userInitials={userInitials}
            links={{ account: "/account", profile: "/account/perfil", projects: "/account/projetos" }}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[76rem] px-4 pb-28 pt-8 sm:px-6 sm:pb-14 sm:pt-12 lg:px-8 lg:pt-14">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/94 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:hidden" aria-label="Navegação móvel do portal do cliente">
        <div className="mx-auto grid max-w-[28rem] grid-cols-3">
          {CLIENT_NAV_ITEMS.map((item) => {
            const active = isClientNavItemActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-micro font-semibold text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.mobileLabel}
              </Link>
            );
          })}
          <Link
            href="/account/perfil"
            aria-current={pathname === "/account/perfil" ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-micro font-semibold text-muted-foreground",
              pathname === "/account/perfil" && "text-primary",
            )}
          >
            <UserRound className="size-5" aria-hidden />
            Conta
          </Link>
        </div>
      </nav>
    </div>
  );
}
