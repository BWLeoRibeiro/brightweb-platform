"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, SkeletonLine } from "@brightweblabs/ui";
import styles from "./shell-surfaces.module.css";

export type ShellNotification = {
  id: string;
  summary: string;
  createdAt: string;
  domain?: string;
};

export type AlertsMenuProps = {
  notifications?: ShellNotification[];
  error?: string | null;
  loading?: boolean;
  unreadCount?: number;
  onLoad?: () => void;
  onOpenChange?: (open: boolean) => void;
};

export function AlertsMenu({ notifications = [], error = null, loading = false, unreadCount = 0, onLoad, onOpenChange }: AlertsMenuProps) {
  const [open, setOpen] = useState(false);
  const handleOpenChange = (next: boolean) => { setOpen(next); if (next) onLoad?.(); onOpenChange?.(next); };
  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild><button id="header-alerts-menu-trigger" className={styles.navbarIconButton} aria-label="Alertas" onPointerEnter={onLoad} onFocus={onLoad}><Bell aria-hidden />{unreadCount > 0 ? <span className={styles.navbarBellBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span> : null}</button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={16} collisionPadding={12} className="w-80 overflow-hidden rounded-[var(--radius-card)] p-0">
        <div className="flex items-center justify-between gap-xs border-b border-[color:var(--border)] px-sm py-xs"><p className="portal-card-title">Alertas</p>{unreadCount > 0 ? <span className="rounded-full bg-[color:var(--badge-count-bg)] px-2 py-0.5 text-[length:var(--text-ui-label)] font-bold text-[color:var(--badge-count-fg)]">{unreadCount > 9 ? "9+" : unreadCount} {unreadCount === 1 ? "nova" : "novas"}</span> : null}</div>
        <div className="flex max-h-96 min-h-[8rem] flex-col overflow-y-auto p-2xs">
          {loading ? <div className="space-y-3 px-sm py-xs"><SkeletonLine w="92%" /><SkeletonLine w="78%" /><SkeletonLine w="88%" /></div> : error ? <div className="portal-meta px-sm py-md text-destructive">{error}</div> : notifications.length === 0 ? <div className="my-auto flex flex-col items-center gap-2xs px-sm py-lg text-center"><span className="mb-2xs flex size-9 items-center justify-center rounded-full bg-accent/10 text-accent"><Bell className="size-4" /></span><p className="portal-micro text-foreground">Sem alertas novos</p><p className="portal-meta">Está tudo em dia.</p></div> : notifications.map((notification) => <div key={notification.id} className="rounded-[var(--radius)] px-sm py-xs transition-colors hover:bg-accent/10"><div className="mb-2xs flex items-center justify-between gap-xs"><span className="portal-micro text-accent">{notification.domain ?? "Sistema"}</span><span className="portal-micro shrink-0 font-normal">{formatDate(notification.createdAt)}</span></div><p className="portal-meta leading-snug text-foreground">{notification.summary}</p></div>)}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
