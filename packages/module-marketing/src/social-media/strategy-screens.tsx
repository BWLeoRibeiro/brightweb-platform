import { Fragment, type CSSProperties } from "react";
import { Globe, BriefcaseBusiness, Camera, Users, ChevronDown, type LucideIcon } from "lucide-react";
import { MeasurementScreen } from "./measurement-screen";
import { SectionHero } from "./section-hero";
import type { SocialMediaCampaigns, SocialMediaCopy, SocialMediaEditorial, SocialMediaPlan, SocialMediaPositioning } from "./types";
import styles from "./strategy-screens.module.css";
import planStyles from "./editorial-plan.module.css";

const channelIcons: Record<string, LucideIcon> = { website: Globe, professional: BriefcaseBusiness, visual: Camera, community: Users };
function Copy({ content }: { content: SocialMediaCopy }) {
  return content.map((part, index) => part.emphasis ? <b key={index}>{part.text}</b> : <Fragment key={index}>{part.text}</Fragment>);
}
function Points({ items }: { items: string[] }) {
  return items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : null;
}

function EditorialPlan({ content, positioning }: { content: SocialMediaEditorial; positioning?: SocialMediaPositioning }) {
  const { sequence, distribution, production } = content;
  return <div className={planStyles.plan}>
    <SectionHero eyebrow={content.eyebrow} title={<>{content.title}{content.titleAccent ? <><br /><span>{content.titleAccent}</span></> : null}</>}>
      <p>{content.introduction}</p>
    </SectionHero>

    {sequence ? <section className={planStyles.monthlySystem}>
      <header className={planStyles.sectionHeading}><span>{sequence.eyebrow}</span><h2>{sequence.title}</h2></header>
      <div className={planStyles.sequence}>
        <p>{sequence.introduction}</p>
        {sequence.steps.length ? <div className="social-content-content-sequence" style={{ "--social-sequence-columns": Math.min(sequence.steps.length, 4) } as CSSProperties}>{sequence.steps.map(step => <div className="social-content-content-step" key={step.label}><span>{step.label}</span><b>{step.title}</b><p>{step.description}</p></div>)}</div> : null}
      </div>
      {sequence.definition ? <aside className={planStyles.campaignDefinition}><div><h3>{sequence.definition.title}</h3><p>{sequence.definition.description}</p></div>{sequence.definition.points.length ? <ul>{sequence.definition.points.map((point, index) => <li key={index}><Copy content={point} /></li>)}</ul> : null}</aside> : null}
    </section> : null}

    {positioning ? <section className={planStyles.direction}>
      <header>
        {positioning.eyebrow ? <span className={planStyles.eyebrow}>{positioning.eyebrow}</span> : null}
        <h2>{positioning.headline}</h2>
        <p>{positioning.statement}</p>
      </header>
      {positioning.principles.length ? <div className={planStyles.principles}>{positioning.principles.map(principle => <div key={principle.title}>
        <h3>{principle.title}</h3><p>{principle.description}</p>
      </div>)}</div> : null}
    </section> : null}

    {distribution && distribution.channels.length ? <section className={planStyles.distribution}>
      <header className={planStyles.sectionHeading}><span>{distribution.eyebrow}</span><h2>{distribution.title}</h2></header>
      <p><Copy content={distribution.introduction} /></p>
      <div className={planStyles.channels}>{distribution.channels.map(channel => {
        const Icon = channel.icon && Object.hasOwn(channelIcons, channel.icon) ? channelIcons[channel.icon] : Globe;
        return <details key={channel.name} className={planStyles.reference}>
          <summary><span className={planStyles.channelIcon}><Icon aria-hidden="true" /></span><span className={planStyles.channelName}><div className="social-content-priority">{channel.priority}</div><strong>{channel.name}</strong></span><ChevronDown className={planStyles.chevron} aria-hidden="true" /></summary>
          <p>{channel.description}</p><Points items={channel.points} />
        </details>;
      })}</div>
    </section> : null}

    {production && (production.formats.length || production.example) ? <section className={planStyles.productionReference}>
      <header className={planStyles.sectionHeading}><span>{production.eyebrow}</span><h2>{production.title}</h2></header>
      {production.formats.length ? <div className={planStyles.formats}>{production.formats.map(format => <details className={planStyles.reference} key={format.label}>
        <summary><strong>{format.label}</strong><ChevronDown className={planStyles.chevron} aria-hidden="true" /></summary>
        <h3>{format.title}</h3><p><Copy content={format.description} /></p>
      </details>)}</div> : null}
      {production.example ? <details className={`${planStyles.reference} ${planStyles.example}`}><summary>{production.example.title}<ChevronDown className={planStyles.chevron} aria-hidden="true" /></summary><Copy content={production.example.description} /></details> : null}
    </section> : null}
  </div>;
}

function CampaignsScreen({ content }: { content: SocialMediaCampaigns }) {
  return <div className={styles.campaignScreen}>
    <SectionHero eyebrow={content.eyebrow} title={content.title}><p>{content.introduction}</p></SectionHero>
    {content.launch ? <section className={styles.campaignLaunch} aria-label="Lançamento"><div className="social-content-launch-date">{content.launch.date}</div><div><h3>{content.launch.title}</h3><p>{content.launch.description}</p></div></section> : null}
    {content.items.length ? <section className={styles.campaignTimeline} aria-label="Campanhas">
      {content.items.map(campaign => <article key={campaign.period}><div className="social-content-num">{campaign.period}</div><h3>{campaign.title}</h3><p><Copy content={campaign.description} /></p><Points items={campaign.points} /></article>)}
    </section> : null}
  </div>;
}

export function StrategyScreen({ id, plan }: { id: string; plan: SocialMediaPlan }) {
  return <section className={`${styles.screen} social-rich`}>
    {id === "plano" && plan.editorial ? <EditorialPlan content={plan.editorial} positioning={plan.positioning} /> : id === "campanhas" && plan.campaigns ? <CampaignsScreen content={plan.campaigns} /> : id === "metricas" && plan.measurement ? <MeasurementScreen content={plan.measurement} /> : null}
  </section>;
}
