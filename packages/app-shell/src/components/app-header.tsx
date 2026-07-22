import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import styles from "./shell-surfaces.module.css";

export type AppHeaderProps = {
  children?: ReactNode;
  className?: string;
  kicker?: string;
  title?: string;
  count?: number;
  trailing?: ReactNode;
  utility?: ReactNode;
};

export function AppHeader({ children, className, kicker, title, count, trailing, utility }: AppHeaderProps) {
  if (!title) return <header className={className}>{children}</header>;

  return (
    <div className={cn(styles.navbarBar, className)}>
      <div className={styles.navbarTitle}>
        <div>
          {kicker ? <span className={styles.navbarKicker}>{kicker}</span> : null}
          <h1>{title}</h1>
        </div>
        {typeof count === "number" && count > 0 ? <span className={styles.navbarCount}>{count.toLocaleString("pt-PT")}</span> : null}
      </div>
      <div className={styles.navbarSpacer} />
      {children}
      {trailing}
      {utility ? <><span className={styles.navbarDivider} /><div className={styles.navbarUtility}>{utility}</div></> : null}
    </div>
  );
}
