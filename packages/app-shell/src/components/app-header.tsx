"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "../lib/utils";
import { triggerShellToolbarAction, useShellActionReady, useShellActionsRegistry } from "../lib/shell-actions";
import { resolveShellToolbarSurface } from "../config";
import type { ShellContextualAction, ShellToolbarRouteConfig, ShellToolbarSurface } from "../types";
import { AlertsMenu, type AlertsMenuProps } from "./alerts-menu";
import styles from "./shell-surfaces.module.css";

export type AppHeaderBreadcrumb = { label: string; href?: string; action?: string };

export type AppHeaderProps = {
  children?: ReactNode;
  className?: string;
  kicker?: string;
  title?: string;
  count?: number;
  trailing?: ReactNode;
  utility?: ReactNode;
  breadcrumbs?: AppHeaderBreadcrumb[];
  pathname?: string;
  toolbarRoutes?: ShellToolbarRouteConfig[];
  toolbarActions?: Partial<Record<ShellToolbarSurface, ShellContextualAction[]>>;
  onToolbarAction?: (action: ShellContextualAction) => void;
  notifications?: AlertsMenuProps;
};

export type AppHeaderToolbarActionButtonProps = {
  action: ShellContextualAction;
  onToolbarAction?: (action: ShellContextualAction) => void;
};

/**
 * Toolbar action button that is registry-aware: when rendered inside a
 * ShellActionsProvider it invokes the registered handler directly and renders
 * disabled until one is registered, so a click can never fire before the
 * target page listener has mounted. Without a provider it falls back to
 * onToolbarAction (legacy behavior).
 */
export function AppHeaderToolbarActionButton({ action, onToolbarAction }: AppHeaderToolbarActionButtonProps) {
  const shellActions = useShellActionsRegistry();
  const ready = useShellActionReady(action.action ?? "");
  const enabled = !shellActions || !action.action || ready;
  return (
    <button type="button" className={styles.navbarContextAction} disabled={!enabled} onClick={() => triggerShellToolbarAction(shellActions, action, onToolbarAction)}>
      <action.icon aria-hidden />
      {action.label}
    </button>
  );
}

function AppHeaderBreadcrumbActionButton({ crumb, backActions, onToolbarAction }: { crumb: AppHeaderBreadcrumb; backActions: ShellContextualAction[]; onToolbarAction?: (action: ShellContextualAction) => void }) {
  const shellActions = useShellActionsRegistry();
  const action = backActions.find((item) => item.action === crumb.action || item.label === crumb.label);
  const ready = useShellActionReady(action?.action ?? "");
  const disabled = Boolean(shellActions && action?.action && !ready);
  return (
    <button type="button" className={styles.navbarCrumbLink} disabled={disabled} onClick={() => { if (action) triggerShellToolbarAction(shellActions, action, onToolbarAction); }}>
      <span aria-hidden>‹</span>
      {crumb.label}
    </button>
  );
}

export function AppHeader({ children, className, kicker, title, count, trailing, utility, breadcrumbs, pathname, toolbarRoutes, toolbarActions, onToolbarAction, notifications }: AppHeaderProps) {
  const surface = pathname && toolbarRoutes ? resolveShellToolbarSurface(pathname, toolbarRoutes) : undefined;
  const registeredActions = surface ? toolbarActions?.[surface] ?? [] : [];
  const backActions = registeredActions.filter((action) => action.placement === "back");
  const contextualActions = registeredActions.filter((action) => action.placement === "contextual");
  const primaryActions = registeredActions.filter((action) => !action.placement);
  const renderedPrimaryActions = children ? [] : primaryActions;
  const resolvedBreadcrumbs: AppHeaderBreadcrumb[] = breadcrumbs ?? backActions.map((action) => ({ label: action.label, action: action.action }));
  const hasContent = Boolean(
    title
    || kicker
    || (typeof count === "number" && count > 0)
    || children
    || trailing
    || utility
    || notifications
    || resolvedBreadcrumbs.length > 0
    || contextualActions.length > 0
    || primaryActions.length > 0
  );

  if (!hasContent) return <header className={className}>{children}</header>;

  return (
    <div className={cn(styles.navbarBar, className)}>
      {title || kicker ? (
        <div className={styles.navbarTitle}>
          <div>
            {kicker ? <span className={styles.navbarKicker}>{kicker}</span> : null}
            {title ? <h1>{title}</h1> : null}
          </div>
          {typeof count === "number" && count > 0 ? <span className={styles.navbarCount}>{count.toLocaleString("pt-PT")}</span> : null}
        </div>
      ) : null}
      <div className={styles.navbarSpacer} />
      {children}
      {resolvedBreadcrumbs.length > 0 ? <nav className={styles.navbarCrumbs} aria-label="Breadcrumb">{resolvedBreadcrumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`} className={styles.navbarCrumb}>{index > 0 ? <span className={styles.navbarCrumbSeparator}>/</span> : null}{crumb.href ? <Link href={crumb.href} className={styles.navbarCrumbLink}><span aria-hidden>‹</span>{crumb.label}</Link> : <AppHeaderBreadcrumbActionButton crumb={crumb} backActions={backActions} onToolbarAction={onToolbarAction} />}</span>)}</nav> : null}
      {contextualActions.map((action) => <AppHeaderToolbarActionButton key={action.action ?? action.label} action={action} onToolbarAction={onToolbarAction} />)}
      {renderedPrimaryActions.map((action) => <AppHeaderToolbarActionButton key={action.action ?? action.label} action={action} onToolbarAction={onToolbarAction} />)}
      {trailing}
      {utility || notifications ? <><span className={styles.navbarDivider} /><div className={styles.navbarUtility}>{utility}{notifications ? <AlertsMenu {...notifications} /> : null}</div></> : null}
    </div>
  );
}
