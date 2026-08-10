"use client";

import { useState } from "react";
import { Bell, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, SkeletonLine } from "@brightweblabs/ui";
import styles from "./shell-surfaces.module.css";

export type ShellNotification = {
  id: string;
  summary: string;
  createdAt: string;
  domain?: string;
  eventType?: string;
  actorProfileId?: string | null;
  actorLabel?: string | null;
  payload?: Record<string, unknown>;
};

export type AlertsMenuProps = {
  notifications?: ShellNotification[];
  error?: string | null;
  loading?: boolean;
  unreadCount?: number;
  seenAt?: string | null;
  onLoad?: () => void;
  onOpenChange?: (open: boolean) => void;
  onDismiss?: (notificationId: string) => void;
  onDismissAll?: () => void;
};

const DOMAIN_LABELS: Record<string, string> = {
  admin: "Admin",
  crm: "CRM",
  projects: "Projetos",
  rbac: "Admin",
};

type AlertsMenuContentProps = Required<Pick<AlertsMenuProps, "notifications" | "loading" | "unreadCount">> & Pick<AlertsMenuProps, "error" | "seenAt" | "onDismiss" | "onDismissAll">;

export function AlertsMenuContent({ notifications, error = null, loading, unreadCount, seenAt = null, onDismiss, onDismissAll }: AlertsMenuContentProps) {
  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
  };
  const seenAtMs = seenAt ? new Date(seenAt).getTime() : null;
  const visibleNotifications = seenAtMs !== null && Number.isFinite(seenAtMs)
    ? notifications.filter((notification) => {
        const createdAt = new Date(notification.createdAt).getTime();
        return !Number.isFinite(createdAt) || createdAt > seenAtMs;
      })
    : notifications;

  return <>
    <div className="flex items-center justify-between gap-xs border-b border-[color:var(--border)] px-sm py-xs"><p className="text-title text-foreground">Alertas</p><div className="flex items-center gap-2">{visibleNotifications.length > 0 && onDismissAll ? <button type="button" className="text-meta text-muted-foreground hover:text-foreground" onClick={onDismissAll}>Limpar</button> : null}{unreadCount > 0 ? <span className="rounded-full bg-[color:var(--badge-count-bg)] px-2 py-0.5 text-label font-bold text-[color:var(--badge-count-fg)]">{unreadCount > 9 ? "9+" : unreadCount} {unreadCount === 1 ? "nova" : "novas"}</span> : null}</div></div>
    <div className="flex max-h-96 min-h-[8rem] flex-col overflow-y-auto p-2xs" aria-busy={loading} aria-live="polite">
      {loading ? <div className="space-y-3 px-sm py-xs" aria-label="A carregar alertas"><SkeletonLine w="92%" /><SkeletonLine w="78%" /><SkeletonLine w="88%" /></div> : error ? <div role="alert" className="text-meta px-sm py-md text-destructive">{error}</div> : visibleNotifications.length === 0 ? <div className="my-auto flex flex-col items-center gap-2xs px-sm py-lg text-center"><span className="mb-2xs flex size-9 items-center justify-center rounded-full bg-accent/10 text-accent"><Bell className="size-4" aria-hidden /></span><p className="text-body font-semibold text-foreground">Sem alertas novos</p><p className="text-meta text-muted-foreground">Está tudo em dia.</p></div> : visibleNotifications.map((notification) => <div key={notification.id} className="group rounded-[var(--radius)] px-sm py-xs transition-colors hover:bg-accent/10"><div className="mb-2xs flex items-center justify-between gap-xs"><span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-micro font-bold text-accent">{DOMAIN_LABELS[notification.domain ?? ""] ?? notification.domain ?? "Sistema"}</span><div className="flex items-center gap-1"><time dateTime={notification.createdAt} className="text-micro text-muted-foreground shrink-0 font-normal">{formatDate(notification.createdAt)}</time>{onDismiss ? <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Dispensar alerta" onClick={() => onDismiss(notification.id)}><X className="size-3.5" aria-hidden /></button> : null}</div></div><p className="text-meta leading-snug text-foreground">{notification.actorLabel ? <><strong>{notification.actorLabel}</strong>{": "}</> : null}{notification.summary}</p></div>)}
    </div>
  </>;
}

export function AlertsMenu({ notifications = [], error = null, loading = false, unreadCount = 0, seenAt = null, onLoad, onOpenChange, onDismiss, onDismissAll }: AlertsMenuProps) {
  const [open, setOpen] = useState(false);
  const handleOpenChange = (next: boolean) => { setOpen(next); if (next) onLoad?.(); onOpenChange?.(next); };
  const triggerLabel = unreadCount > 0
    ? `Alertas, ${unreadCount} ${unreadCount === 1 ? "novo" : "novos"}`
    : "Alertas";

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild><button type="button" id="header-alerts-menu-trigger" className={styles.navbarIconButton} aria-label={triggerLabel} onPointerEnter={onLoad} onFocus={onLoad}><Bell aria-hidden />{unreadCount > 0 ? <span className={styles.navbarBellBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span> : null}</button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={16} collisionPadding={12} className="w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-[var(--radius-card)] p-0">
        <AlertsMenuContent notifications={notifications} error={error} loading={loading} unreadCount={unreadCount} seenAt={seenAt} onDismiss={onDismiss} onDismissAll={onDismissAll} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
