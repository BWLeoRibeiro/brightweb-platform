"use client";

import { useState } from "react";
import { ArrowRight, Bookmark, ChevronDown, MessagesSquare, MousePointer2, Users } from "lucide-react";
import type { SocialMediaMeasurement } from "./types";
import { safeSocialMediaHref } from "./model";
import { SectionHero } from "./section-hero";
import styles from "./measurement-screen.module.css";

const signalIcons = { audience: Users, engagement: Bookmark, traffic: MousePointer2, conversation: MessagesSquare };

export function MeasurementScreen({ content }: { content: SocialMediaMeasurement }) {
  const [selectedSignal, setSelectedSignal] = useState(0);
  const references = content.references;
  const activeSignal = content.signals[selectedSignal] ?? content.signals[0];

  return <div className={styles.measurement}>
    <div className={styles.overview}>
      <SectionHero eyebrow={content.period} title={content.title}><p>{content.introduction}</p></SectionHero>
      {content.deliverables.length > 0 ? <section className={styles.delivery} aria-labelledby="measurement-delivery">
        <h3 id="measurement-delivery">O plano de publicação</h3>
        <dl>{content.deliverables.map(item => <div key={item.label}>
          <dt>{item.label}</dt><dd><strong>{item.value}</strong><span>{item.description}</span></dd>
        </div>)}</dl>
      </section> : null}
    </div>

    {activeSignal ? <section aria-labelledby="measurement-signals">
      <header className={styles.sectionHeading}><h3 id="measurement-signals">Como sabemos se está a funcionar</h3>{content.signalsIntroduction ? <p>{content.signalsIntroduction}</p> : null}</header>
      <div className={styles.signalWorkspace}>
        <div className={styles.signalChoices} role="group" aria-label="Aspetos a acompanhar">
          {content.signals.map((signal, index) => {
            const Icon = signal.icon && Object.hasOwn(signalIcons, signal.icon) ? signalIcons[signal.icon as keyof typeof signalIcons] : Users;
            return <button key={signal.title} type="button" aria-pressed={signal === activeSignal} aria-controls="measurement-signal-detail" onClick={() => setSelectedSignal(index)}>
              <Icon aria-hidden="true" /><span>{signal.title}</span><ArrowRight aria-hidden="true" />
            </button>;
          })}
        </div>
        <div className={styles.signalDetail} id="measurement-signal-detail" aria-live="polite" aria-atomic="true">
          <p className={styles.eyebrow}>O que queremos perceber</p>
          <h4>{activeSignal.question}</h4>
          <p className={styles.interpretation}>{activeSignal.interpretation}</p>
          {activeSignal.indicators.length > 0 ? <div className={styles.indicatorGroup}><p>O que acompanhamos</p><ul>{activeSignal.indicators.map(indicator => <li key={indicator}>{indicator}</li>)}</ul></div> : null}
        </div>
      </div>
    </section> : null}

    {content.routine || content.baseline || content.decisions.length > 0 ? <section aria-labelledby="measurement-decisions">
      <div className={styles.reviewIntroduction}>
        <header className={styles.sectionHeading}><h3 id="measurement-decisions">Como vamos usar os resultados</h3>{content.routine ? <p>{content.routine}</p> : null}</header>
        {content.baseline ? <aside className={styles.baseline} aria-label={content.baseline.ariaLabel ?? "Ponto de partida"}>
          <p className={styles.eyebrow}>Ponto de partida · {content.baseline.date}</p>
          <p className={styles.baselineFact}><strong>{content.baseline.value}</strong> {content.baseline.label}</p>
          <p>{content.baseline.description}</p>
        </aside> : null}
      </div>
      {content.decisions.length > 0 ? <ol className={styles.timeline}>{content.decisions.map(decision => <li key={decision.when}>
        <p className={styles.eyebrow}>{decision.when}</p>
        <div className={styles.reviewQuestion}><h4>{decision.title}</h4><p>{decision.description}</p></div>
        {decision.outcome ? <div className={styles.reviewOutcome}><p className={styles.eyebrow}>O que será apresentado</p><p>{decision.outcome}</p></div> : null}
      </li>)}</ol> : null}
    </section> : null}

    {references && references.rows.length > 0 ? <details className={styles.references}>
      <summary><span>{references.title}{references.description ? <small>{references.description}</small> : null}</span><ChevronDown aria-hidden="true" /></summary>
      <div className={styles.referenceContent}>{references.note ? <p className="social-content-benchmark-note">{references.note}</p> : null}<div className="social-content-table-wrap"><table className="social-content-benchmark-table">
        <thead><tr><th>{references.columns.name}</th><th>{references.columns.value}</th><th>{references.columns.interpretation}</th><th>{references.columns.source}</th></tr></thead>
        <tbody>{references.rows.map((row) => {
          const href = safeSocialMediaHref(row.source.href);
          return <tr key={row.name} className={row.context ? "social-content-context-row" : undefined}>
            <td><b>{row.name}</b>{row.context ? <><br /><small>{row.context}</small></> : null}</td>
            <td>{row.value}</td><td>{row.interpretation}</td>
            <td>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{row.source.label}</a> : row.source.label}</td>
          </tr>;
        })}</tbody>
      </table></div></div>
    </details> : null}
  </div>;
}
