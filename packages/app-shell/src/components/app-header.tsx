import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "../lib/utils";
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
      {resolvedBreadcrumbs.length > 0 ? <nav className={styles.navbarCrumbs} aria-label="Breadcrumb">{resolvedBreadcrumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`} className={styles.navbarCrumb}>{index > 0 ? <span className={styles.navbarCrumbSeparator}>/</span> : null}{crumb.href ? <Link href={crumb.href} className={styles.navbarCrumbLink}><span aria-hidden>‹</span>{crumb.label}</Link> : <button type="button" className={styles.navbarCrumbLink} onClick={() => { const action = backActions.find((item) => item.action === crumb.action || item.label === crumb.label); if (action) onToolbarAction?.(action); }}><span aria-hidden>‹</span>{crumb.label}</button>}</span>)}</nav> : null}
      {contextualActions.map((action) => <button key={action.action ?? action.label} type="button" className={styles.navbarContextAction} onClick={() => onToolbarAction?.(action)}><action.icon aria-hidden />{action.label}</button>)}
      {renderedPrimaryActions.map((action) => <button key={action.action ?? action.label} type="button" className={styles.navbarContextAction} onClick={() => onToolbarAction?.(action)}><action.icon aria-hidden />{action.label}</button>)}
      {trailing}
      {utility || notifications ? <><span className={styles.navbarDivider} /><div className={styles.navbarUtility}>{utility}{notifications ? <AlertsMenu {...notifications} /> : null}</div></> : null}
    </div>
  );
}
