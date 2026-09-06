import { BookOpen, CalendarDays, Flag, MessageSquare, Target } from "lucide-react";
import { Card } from "@brightweblabs/ui";
import type { SocialMediaPositioning } from "./types";
import styles from "./positioning-screen.module.css";

export function PositioningScreen({ content }: { content: SocialMediaPositioning }) {
  const rhythmIcons = { calendar: CalendarDays, article: BookOpen, campaign: Flag };
  return <section className={styles.layout} aria-label="Posicionamento">
    <div className={styles.main}>
    <Card className={styles.message}>
      <div className={styles.label}><span className={styles.icon}><Target aria-hidden="true" /></span><span>Posicionamento</span></div>
      <h2 className={styles.headline}>{content.headline}</h2>
      <p className={styles.statement}>{content.statement}</p>
    </Card>
      {content.principles.length > 0 ? <div className={styles.principles}>{content.principles.map((principle) => <Card className={styles.principle} key={principle.title}>
        <h3>{principle.title}</h3>
        <p>{principle.description}</p>
      </Card>)}</div> : null}
    </div>
    {content.rhythm && content.rhythm.length > 0 ? <Card className={styles.rhythm}>
      <div className={styles.label}><span className={styles.icon}><MessageSquare aria-hidden="true" /></span><h2>Ritmo de publicação</h2></div>
      <dl>{content.rhythm.map((item) => {
        const Icon = item.icon && Object.hasOwn(rhythmIcons, item.icon) ? rhythmIcons[item.icon as keyof typeof rhythmIcons] : CalendarDays;
        return <div className={styles.rhythmItem} key={item.label}><Icon aria-hidden="true" /><div><dt>{item.label}</dt><dd>{item.description}</dd></div></div>;
      })}</dl>
    </Card> : null}
  </section>;
}
