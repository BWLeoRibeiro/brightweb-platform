import type { ReactNode } from "react";
import styles from "./section-hero.module.css";

export function SectionHero({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return <header className={styles.hero}>
    <p className={styles.eyebrow}>{eyebrow}</p>
    <h2 className={styles.title}>{title}</h2>
    <div className={styles.lead}>{children}</div>
  </header>;
}
