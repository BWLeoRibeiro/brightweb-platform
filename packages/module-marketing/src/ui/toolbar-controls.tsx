"use client";

import { useEffect, useState } from "react";
import { Filter, Plus } from "lucide-react";
import { ToolbarSearchField, useShellActionDispatch, useShellActionsReady } from "@brightweblabs/app-shell";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@brightweblabs/ui";
import { MARKETING_EVENTS, type MarketingStateEventDetail, type MarketingStatusFilter } from "./events";

const campaignStatuses = ["all", "draft", "scheduled", "sending", "sent", "canceled", "failed"] as const;
const workflowStatuses = ["all", "draft", "active", "paused"] as const;
const labels: Record<MarketingStatusFilter, string> = {
  all: "Todos", draft: "Rascunho", scheduled: "Agendada", sending: "A enviar", sent: "Enviada",
  canceled: "Cancelada", failed: "Falhou", active: "Ativa", paused: "Em pausa",
};

export function MarketingToolbarControls() {
  const dispatch = useShellActionDispatch();
  const ready = useShellActionsReady([MARKETING_EVENTS.setSearch, MARKETING_EVENTS.setStatusFilter, MARKETING_EVENTS.create]);
  const [view, setView] = useState<MarketingStateEventDetail["view"]>("campaigns");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MarketingStatusFilter>("all");
  const [draftStatus, setDraftStatus] = useState<MarketingStatusFilter>("all");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleState = (event: Event) => {
      const detail = (event as CustomEvent<MarketingStateEventDetail>).detail;
      if (!detail) return;
      setView(detail.view);
      setSearch(detail.search);
      setStatus(detail.status);
    };
    window.addEventListener(MARKETING_EVENTS.state, handleState);
    return () => window.removeEventListener(MARKETING_EVENTS.state, handleState);
  }, []);

  if (view === "analytics") return null;
  const statuses = view === "campaigns" ? campaignStatuses : view === "workflows" ? workflowStatuses : null;
  const placeholder = view === "campaigns" ? "Procurar campanhas…" : view === "segments" ? "Procurar segmentos…" : "Procurar automações…";
  const createLabel = view === "campaigns" ? "Nova campanha" : view === "segments" ? "Novo segmento" : "Nova automação";

  return (
    <div className="flex min-w-max flex-wrap items-center gap-2">
      <ToolbarSearchField value={search} disabled={!ready} placeholder={placeholder} onChange={(value) => {
        setSearch(value);
        dispatch(MARKETING_EVENTS.setSearch, { query: value });
      }} />
      {statuses ? (
        <Popover open={open} onOpenChange={(next) => { setDraftStatus(status); setOpen(next); }}>
          <PopoverTrigger asChild>
            <button type="button" disabled={!ready} className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] px-3 text-body font-extrabold text-[color:var(--foreground)] disabled:opacity-60">
              <Filter className="size-[var(--toolbar-icon-size)]" aria-hidden />Filtros
              {status !== "all" ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-micro text-accent-foreground">1</span> : null}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" collisionPadding={12} className="w-[min(var(--toolbar-popover-width),calc(100vw-2rem))] p-4">
            <div className="mb-3 flex items-center justify-between"><strong>Filtros</strong><button type="button" className="text-meta underline" onClick={() => setDraftStatus("all")}>Limpar</button></div>
            <span className="mb-2 block text-micro font-extrabold uppercase text-muted-foreground">Estado</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Estado">{statuses.map((value) => <button type="button" key={value} aria-pressed={draftStatus === value} onClick={() => setDraftStatus(value)} className={`h-[var(--toolbar-chip-height)] rounded-full border px-3 text-meta ${draftStatus === value ? "border-[color:var(--border-selection)] bg-[color:var(--surface-selection)]" : "border-[color:var(--hairline)]"}`}>{labels[value]}</button>)}</div>
            <Button type="button" className="mt-4 h-9 w-full" onClick={() => { setStatus(draftStatus); dispatch(MARKETING_EVENTS.setStatusFilter, { status: draftStatus }); setOpen(false); }}>Aplicar</Button>
          </PopoverContent>
        </Popover>
      ) : null}
      <Button type="button" disabled={!ready} className="h-9" onClick={() => dispatch(MARKETING_EVENTS.create)}><Plus aria-hidden />{createLabel}</Button>
    </div>
  );
}
