import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import styles from "./shell-surfaces.module.css";

export type AppShellFrameProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  mobileNav?: ReactNode;
  children: ReactNode;
  collapsed?: boolean;
  className?: string;
};

export function AppShellFrame({ sidebar, header, mobileNav, children, collapsed = false, className }: AppShellFrameProps) {
  return (
    <div className={cn(styles.shellRoot, className)}>
      <div className={cn(styles.shellDesktopFrame, collapsed && styles.shellDesktopFrameCollapsed)}>
        {sidebar}
        <div className={styles.desktopContent}>
          {header ? <header className={styles.headerBar}>{header}</header> : null}
          {mobileNav ? <div className={styles.mobileNav}>{mobileNav}</div> : null}
          <main className={styles.mainContent}>{children}</main>
        </div>
      </div>
    </div>
  );
}
