"use client";

import { useEffect, useState } from "react";
import { StrategyScreen } from "./strategy-screens";
import { PositioningScreen } from "./positioning-screen";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Copy, FileText, List } from "lucide-react";
import { AppSheetBody, AppSheetHeader, PillTabs, SheetSection } from "@brightweblabs/app-shell";
import { Badge, Button, Card, CardContent, Sheet, SheetContent } from "@brightweblabs/ui";
import { calendarDays, filterPublications, publicationMonths, safeSocialMediaHref } from "./model";
import type { SocialMediaPlan, SocialMediaPublication, SocialMediaPublicationType } from "./types";
import "../../tokens.css";
import "../../marketing.css";
import "./social-media.css";

const monthLabel = (month: string) => new Intl.DateTimeFormat("pt-PT", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
const dateLabel = (date: string) => new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

function PublicationBrief({ event, publicationType }: { event: SocialMediaPublication; publicationType: SocialMediaPublicationType }) {
  const [copyState, setCopyState] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(event.baseText);
      setCopyState("Texto copiado.");
    } catch {
      setCopyState("Não foi possível copiar. Selecione o texto abaixo e copie manualmente.");
    }
  }
  return <>
    <AppSheetHeader
      icon={FileText}
      className="social-brief-header"
      title={event.title}
      description={`${publicationType.label} · ${dateLabel(event.date)}`}
    />
    <AppSheetBody className="social-brief-body">
      <SheetSection title="Plano da publicação" bodyClassName="social-brief-plan">
        <div className="social-brief-objective"><span>Objetivo</span><p>{event.summary}</p></div>
        <dl className="social-brief-facts">
          <div className="social-brief-fact"><dt>Canais</dt><dd>{event.channels}</dd></div>
          <div className="social-brief-fact"><dt>Formato</dt><dd>{event.format}</dd></div>
        </dl>
        <dl className="social-brief-details">
          <div><dt>{publicationType.medium === "website" ? "Publicação" : "Interação"}</dt><dd>{event.interaction}</dd></div>
          <div><dt>Ligação ao serviço</dt><dd>{event.service}</dd></div>
          <div className="social-brief-cta"><dt>Chamada para ação</dt><dd>{event.cta}</dd></div>
        </dl>
      </SheetSection>

      <SheetSection title="Texto-base" className="social-draft" bodyClassName="social-draft-content" aside={<Button variant="outline" size="sm" onClick={copy}><Copy aria-hidden="true" />Copiar texto</Button>}>
        <p className="social-copy-status text-meta" role="status" aria-live="polite">{copyState}</p>
        <div className="social-draft-body"><p className="social-draft-text">{event.baseText}</p></div>
      </SheetSection>

      {event.references.length > 0 || event.editorialNote ? <details className="social-brief-source-disclosure">
        <summary><span>Fontes e notas</span>{event.references.length > 0 ? <span className="social-brief-source-count">{event.references.length}</span> : null}<ChevronDown aria-hidden="true" /></summary>
        <div className="social-brief-sources"><ol className="social-references">{event.references.map(([label, url], index) => {
          const href = safeSocialMediaHref(url);
          return <li key={index}><span>{index + 1}</span>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{label}</a> : <p>{label}</p>}</li>;
        })}</ol><p className="social-brief-source-note">{event.editorialNote}</p></div>
      </details> : null}
    </AppSheetBody>
  </>;
}

export function SocialMediaClient({ plan }: { plan: SocialMediaPlan }) {
  const months = publicationMonths(plan.events);
  const [month, setMonth] = useState(months[0] ?? "");
  const monthIndex = months.indexOf(month);
  const [type, setType] = useState("all");
  const [view, setView] = useState<"calendar" | "details">("calendar");
  const [section, setSection] = useState("calendario");
  useEffect(() => {
    const restoreSection = () => {
      const requested = window.location.hash.slice(1);
      setSection(plan.sections.some(item => item.id === requested) ? requested : "calendario");
    };
    restoreSection();
    window.addEventListener("hashchange", restoreSection);
    window.addEventListener("popstate", restoreSection);
    return () => {
      window.removeEventListener("hashchange", restoreSection);
      window.removeEventListener("popstate", restoreSection);
    };
  }, [plan.sections]);
  function selectSection(value: string) {
    if (value === section) return;
    window.history.pushState(null, "", `#${value}`);
    setSection(value);
  }
  const [selected, setSelected] = useState<SocialMediaPublication | null>(null);
  const publications = filterPublications(plan.events, month, type);
  const websiteCount = publications.filter(event => plan.types[event.type].medium === "website").length;
  const typeFilters = [{ value: "all", label: "Tudo" }, ...Object.entries(plan.types).map(([value, item]) => ({ value, label: item.label }))];
  const sectionTabs = [...plan.sections.filter((item) => item.id === "calendario"), ...plan.sections.filter((item) => item.id !== "calendario")].map((item) => ({ value: item.id, label: item.title }));

  return <div className="marketing-workspace social-workspace">
    <div className="marketing-view-nav"><PillTabs ariaLabel="Secções de Social Media" items={sectionTabs} value={section} onValueChange={selectSection} /></div>
    {section === "calendario" ? <Card className="marketing-ledger"><CardContent className="p-0">
      <div className="social-controls">
        <div className="social-controls-row"><div className="social-month-navigation" role="group" aria-label="Mês">
          <Button type="button" size="icon" variant="ghost" aria-label="Mês anterior" title="Mês anterior" disabled={monthIndex <= 0} onClick={() => setMonth(months[monthIndex - 1])}><ChevronLeft aria-hidden="true" /></Button>
          <span className="social-month-label" aria-live="polite">{month ? `${monthLabel(month)} ${month.slice(0, 4)}` : "Sem publicações"}</span>
          <Button type="button" size="icon" variant="ghost" aria-label="Mês seguinte" title="Mês seguinte" disabled={monthIndex < 0 || monthIndex >= months.length - 1} onClick={() => setMonth(months[monthIndex + 1])}><ChevronRight aria-hidden="true" /></Button>
        </div><div className="flex items-center gap-1" role="group" aria-label="Vista">
          <Button type="button" size="icon" variant={view === "calendar" ? "default" : "ghost"} aria-label="Calendário" title="Calendário" aria-pressed={view === "calendar"} onClick={() => setView("calendar")}><CalendarDays aria-hidden="true" /></Button>
          <Button type="button" size="icon" variant={view === "details" ? "default" : "ghost"} aria-label="Publicações" title="Publicações" aria-pressed={view === "details"} onClick={() => setView("details")}><List aria-hidden="true" /></Button>
        </div></div>
        <div className="social-filters" role="group" aria-label="Tipo de publicação">{typeFilters.map(({ value, label }) => <Button key={value} size="sm" variant={type === value ? "default" : "outline"} aria-pressed={type === value} onClick={() => setType(value)}>{label}</Button>)}</div>
        <p className="text-meta text-muted-foreground" role="status">{publications.length} {publications.length === 1 ? "conteúdo" : "conteúdos"} em {month ? monthLabel(month) : "este mês"}{publications.length > 0 ? ` · ${publications.length - websiteCount} nas redes · ${websiteCount} no website` : ""}</p>
      </div>
      {publications.length === 0 ? <div className="social-empty"><p>Não há publicações deste tipo neste mês.</p>{type !== "all" ? <Button variant="outline" onClick={() => setType("all")}>Mostrar todas</Button> : null}</div> : view === "calendar" ?
        <div className="social-calendar-scroll" tabIndex={0} role="region" aria-label="Calendário mensal, deslize para ver todos os dias">
          <div className="social-calendar">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <div key={day} className="social-weekday">{day}</div>)}
            {calendarDays(month).map((day) => <div key={day.date} className={`social-day${day.inMonth ? "" : " social-day-outside"}`}>
              <time dateTime={day.date} className="text-meta">{day.day}</time>
              {plan.holidays?.[day.date] ? <span className="social-holiday">{plan.holidays[day.date]}</span> : null}
              {publications.filter((event) => event.date === day.date).map((event) => <button key={event.id} type="button" className="social-event" data-tone={plan.types[event.type].tone ?? "primary"} onClick={() => setSelected(event)} aria-label={`${dateLabel(event.date)}: ${event.title}`}><span>{plan.types[event.type].label}</span><strong>{event.title}</strong><small>{event.channels}</small></button>)}
            </div>)}
          </div>
        </div> : <div className="social-publications">{publications.map((event) => <button type="button" className="social-publication-row" key={event.id} onClick={() => setSelected(event)}><div><time dateTime={event.date}>{dateLabel(event.date)}</time><Badge variant="outline">{plan.types[event.type].label}</Badge></div><div><strong className="text-title">{event.title}</strong><p className="text-meta text-muted-foreground">{event.channels}</p></div><span className="text-meta social-open-brief">Ver plano →</span></button>)}</div>}
    </CardContent></Card> : section === "decisao" && plan.positioning ? <PositioningScreen content={plan.positioning} /> : <StrategyScreen id={section} plan={plan} />}
    <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}><SheetContent className="social-brief !w-full sm:!max-w-[45rem]">{selected ? <PublicationBrief key={selected.id} event={selected} publicationType={plan.types[selected.type]} /> : null}</SheetContent></Sheet>
  </div>;
}
