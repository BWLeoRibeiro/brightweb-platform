"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Circle, Clock, Cloud, ExternalLink, FileText, Flag, Link2, Sheet } from "lucide-react";
import { Button, Card } from "@brightweblabs/ui";
import type { ClientProjectDetail } from "../../client-contracts";
import type { MilestoneStatus, ProjectLinkKind } from "../../contracts";
import { CLIENT_MILESTONE_STATUS_CLASSES, CLIENT_MILESTONE_STATUS_LABELS, CLIENT_PROJECT_LINK_KIND_LABELS, CLIENT_PROJECT_STATUS_LABELS, clientProjectsDictionary } from "./dictionary";
import { formatClientProjectDate, isClientProjectDateOverdue } from "./shared";
import { ClientProjectDetailLoading } from "./projects-loading";
import { ProjectStatusBadge } from "../project-state-badge";
import { ProjectProgressBar } from "../shared/project-progress";

const META_ICONS: Record<MilestoneStatus, ReactNode> = {
  pending: <Circle className="size-3.5" />,
  in_progress: <Clock className="size-3.5" />,
  achieved: <CheckCircle2 className="size-3.5" />,
  delayed: <AlertCircle className="size-3.5" />,
};

const DOCUMENT_ICONS: Record<ProjectLinkKind, ReactNode> = {
  doc: <FileText className="size-4" />,
  sheet: <Sheet className="size-4" />,
  drive: <Cloud className="size-4" />,
  other: <Link2 className="size-4" />,
};

function unwrapDetail(payload: unknown): ClientProjectDetail | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const candidate = record.data && typeof record.data === "object" ? record.data : record;
  if (!candidate || typeof candidate !== "object") return null;
  const detail = candidate as Partial<ClientProjectDetail>;
  return typeof detail.id === "string" && typeof detail.name === "string" && Array.isArray(detail.metas) && Array.isArray(detail.documents)
    ? detail as ClientProjectDetail
    : null;
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card asChild variant="elevated">
      <section className="panel preview-glass-card"><div className="panel-inner space-y-4">
        <Link href="/account/projetos" className="inline-flex items-center gap-2 text-body font-semibold text-primary"><ArrowLeft className="size-4" />{clientProjectsDictionary.safeUi.projectsBack}</Link>
        <h1 className="text-heading-2 font-semibold">{title}</h1>
        {children}
      </div></section>
    </Card>
  );
}

function HeroFact({ label, value, emphasis = false }: { label: string; value: ReactNode; emphasis?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-micro font-semibold text-[color:var(--project-hero-muted)]">{label}</dt>
      <dd className={`text-data mt-1 truncate text-body font-semibold ${emphasis ? "text-[color:var(--brand-accent)]" : ""}`}>{value}</dd>
    </div>
  );
}

export function ClientProjectDetailClient({ projectId, initialProject }: { projectId: string; initialProject?: ClientProjectDetail | null }) {
  const [project, setProject] = useState<ClientProjectDetail | null>(() => initialProject ?? null);
  const [state, setState] = useState<"loading" | "ready" | "not_found" | "error">(() => (
    initialProject === undefined ? "loading" : initialProject ? "ready" : "not_found"
  ));
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (reloadKey === 0 && initialProject !== undefined) return;
    const controller = new AbortController();
    setProject(null);
    setState("loading");
    fetch(`/api/account/projects/${encodeURIComponent(projectId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404 || response.status === 403) { setState("not_found"); return; }
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Unable to load project");
        const detail = unwrapDetail(payload);
        if (!detail) throw new Error("Invalid project response");
        setProject(detail);
        setState("ready");
      })
      .catch((cause) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, [initialProject, projectId, reloadKey]);

  const metas = useMemo(() => [...(project?.metas ?? [])].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return (a.targetDate ?? "9999-12-31").localeCompare(b.targetDate ?? "9999-12-31");
  }), [project]);

  if (state === "loading") return <ClientProjectDetailLoading />;
  if (state === "not_found") return <Message title={clientProjectsDictionary.safeUi.notFoundTitle}><p className="text-body text-muted-foreground">{clientProjectsDictionary.safeUi.notFoundDescription}</p></Message>;
  if (state === "error" || !project) return <Message title={clientProjectsDictionary.safeUi.openErrorTitle}><p className="text-body text-muted-foreground">{clientProjectsDictionary.safeUi.openErrorDescription}</p><Button type="button" variant="outline" size="sm" onClick={() => setReloadKey((current) => current + 1)}>{clientProjectsDictionary.safeUi.retry}</Button></Message>;

  const overdue = isClientProjectDateOverdue(project.targetDate) && !["completed", "canceled"].includes(project.status);
  const achievedCount = metas.filter((meta) => meta.status === "achieved").length;
  const displayPercent = project.progress.percent ?? (metas.length > 0 ? Math.round((achievedCount / metas.length) * 100) : null);
  const highlightedMeta = metas.find((meta) => meta.status === "delayed")
    ?? metas.find((meta) => meta.status === "in_progress")
    ?? metas.find((meta) => meta.status === "pending")
    ?? null;
  const hasNarrative = Boolean(project.clientSummary || project.clientScope);
  const hasProjectPulse = metas.length > 0;

  return (
    <article className="space-y-8 sm:space-y-10">
      <Link href="/account/projetos" className="inline-flex min-h-11 items-center gap-1.5 text-body font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{clientProjectsDictionary.safeUi.projectsBack}</Link>

      <header className="brand-panel relative overflow-hidden rounded-[var(--radius-panel)] border border-[color:var(--project-hero-border)] p-6 text-[color:var(--project-hero-foreground)] shadow-[var(--project-hero-shadow)] sm:p-8 lg:p-10">
        <span aria-hidden className="pointer-events-none absolute -right-24 -top-32 size-96 rounded-full bg-[color:var(--brand-accent)]/15 blur-3xl" />
        <div className={`relative grid gap-8 ${hasProjectPulse ? "lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end" : ""}`}>
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <ProjectStatusBadge status={project.status} label={CLIENT_PROJECT_STATUS_LABELS[project.status]} size="small" />
              {project.reference ? <span className="text-data text-meta text-[color:var(--project-hero-muted)]">{project.reference}</span> : null}
            </div>
            <h1 className="font-display max-w-[48rem] text-[length:var(--text-ui-preview-card-title)] font-black leading-[var(--type-leading-110)] tracking-[var(--type-tracking-n025)] sm:text-[length:var(--text-ui-dashboard-title-lg)]">{project.name}</h1>
            <p className="text-body-lg text-[color:var(--project-hero-muted)]">{project.organizations.map((organization) => organization.name).join(" · ")}</p>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-[color:var(--project-hero-border)] pt-5 sm:flex sm:flex-wrap sm:gap-x-12">
              <HeroFact label={clientProjectsDictionary.safeUi.startDate} value={formatClientProjectDate(project.startDate)} />
              <HeroFact
                label={clientProjectsDictionary.safeUi.deadline}
                value={overdue ? `${formatClientProjectDate(project.targetDate)} · ${clientProjectsDictionary.common.delayed}` : formatClientProjectDate(project.targetDate)}
                emphasis={overdue}
              />
              {project.clientContact ? <HeroFact label={clientProjectsDictionary.safeUi.contact} value={project.clientContact.email ? <a className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]" href={`mailto:${project.clientContact.email}`}>{project.clientContact.label}</a> : project.clientContact.label} /> : null}
            </dl>
          </div>
          {hasProjectPulse ? (
            <aside className="rounded-[var(--radius-card)] border border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-surface-raised)] p-5" aria-labelledby="client-project-progress-title">
              <p id="client-project-progress-title" className="text-label" style={{ color: "var(--project-hero-muted)" }}>{clientProjectsDictionary.safeUi.projectProgress}</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <p className="font-display text-[length:var(--text-ui-dashboard-title-lg)] font-black leading-none">{displayPercent ?? 0}%</p>
                <p className="pb-1 text-right text-meta" style={{ color: "var(--project-hero-muted)" }}>{achievedCount} {clientProjectsDictionary.safeUi.of} {metas.length}</p>
              </div>
              {displayPercent !== null ? <ProjectProgressBar ariaLabel={clientProjectsDictionary.safeUi.progress} percent={displayPercent} className="mt-4" trackClassName="bg-[color:var(--project-hero-border)]" fillClassName="bg-[color:var(--accent)]" /> : null}
              {highlightedMeta ? (
                <div className="mt-5 border-t border-[color:var(--project-hero-border)] pt-4">
                  <p className="flex items-center gap-2 text-label" style={{ color: "var(--project-hero-muted)" }}><Flag aria-hidden className="size-3.5 text-[color:var(--accent)]" />{clientProjectsDictionary.safeUi.highlightedMilestone}</p>
                  <p className="mt-2 text-body font-bold leading-snug">{highlightedMeta.title}</p>
                  <p className="mt-1 text-meta" style={{ color: "var(--project-hero-muted)" }}>{CLIENT_MILESTONE_STATUS_LABELS[highlightedMeta.status]}{highlightedMeta.targetDate ? ` · ${formatClientProjectDate(highlightedMeta.targetDate)}` : ""}</p>
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      </header>

      <div className={`grid items-start gap-6 lg:gap-8 ${hasNarrative ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
        {hasNarrative ? (
          <section className="rounded-[var(--radius-card)] border border-border/55 bg-background/55 p-6 shadow-[var(--dashboard-shadow-sm)] sm:p-8" aria-labelledby="client-project-story-title">
            {project.clientSummary ? (
              <div className="border-l-2 border-primary pl-5 sm:pl-6">
                <h2 id="client-project-story-title" className="text-label font-semibold text-muted-foreground">{clientProjectsDictionary.safeUi.summary}</h2>
                <p className="mt-3 max-w-[44rem] text-body-lg leading-relaxed text-foreground">{project.clientSummary}</p>
              </div>
            ) : null}
            {project.clientScope ? (
              <div className={project.clientSummary ? "mt-8 border-t border-border/65 pt-8" : ""}>
                <h2 id={project.clientSummary ? undefined : "client-project-story-title"} className="text-label font-semibold text-muted-foreground">{clientProjectsDictionary.safeUi.scope}</h2>
                <p className="mt-3 max-w-[44rem] whitespace-pre-line text-body leading-relaxed text-muted-foreground">{project.clientScope}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className={`rounded-[var(--radius-card)] border border-border/55 bg-[color:var(--project-surface-secondary)] p-5 shadow-[var(--dashboard-shadow-sm)] sm:p-6 ${hasNarrative ? "lg:sticky lg:top-24" : ""}`} aria-labelledby="client-project-milestones-title">
          <div>
            <p className="text-label text-primary">{clientProjectsDictionary.safeUi.metas}</p>
            <h2 id="client-project-milestones-title" className="mt-1 text-title font-bold">{clientProjectsDictionary.safeUi.milestoneJourney}</h2>
          </div>
          {metas.length === 0 ? <p className="mt-4 rounded-2xl border border-border/60 bg-background/50 px-5 py-8 text-body text-muted-foreground">{clientProjectsDictionary.safeUi.noSharedMetas}</p> : (
            <ol className="relative mt-4 space-y-0 before:absolute before:bottom-5 before:left-[1.15rem] before:top-5 before:w-px before:bg-border">{metas.map((meta) => (
              <li key={meta.id} className="relative grid grid-cols-[2.35rem_minmax(0,1fr)] gap-4 py-4">
                <span className={`z-10 inline-flex size-[2.35rem] items-center justify-center rounded-full border border-border bg-background ${CLIENT_MILESTONE_STATUS_CLASSES[meta.status]}`}>{META_ICONS[meta.status]}</span>
                <div className="pt-1"><p className={`text-body font-bold ${meta.status === "achieved" ? "text-muted-foreground" : ""}`}>{meta.title}</p><p className="mt-1 text-meta text-muted-foreground">{CLIENT_MILESTONE_STATUS_LABELS[meta.status]}{meta.completedAt || meta.targetDate ? ` · ${formatClientProjectDate(meta.completedAt ?? meta.targetDate)}` : ""}</p></div>
              </li>
            ))}</ol>
          )}
        </section>
      </div>

        <section className="border-t border-border/65 pt-8 sm:pt-10" aria-labelledby="client-project-documents-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-label text-primary">{clientProjectsDictionary.safeUi.sharedMaterialsEyebrow}</p>
              <h2 id="client-project-documents-title" className="mt-1 text-heading-3 font-bold">{clientProjectsDictionary.safeUi.sharedDocuments}</h2>
            </div>
            {project.documents.length > 0 ? <p className="text-meta text-muted-foreground">{clientProjectsDictionary.safeUi.sharedMaterialCount(project.documents.length)}</p> : null}
          </div>
          {project.documents.length === 0 ? <p className="mt-3 text-body text-muted-foreground">{clientProjectsDictionary.safeUi.noSharedDocuments}</p> : (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{project.documents.map((document) => (
              <li key={document.id}><a href={document.url} target="_blank" rel="noreferrer" className="group flex min-h-20 items-center gap-3 rounded-[var(--radius-card)] border border-border/60 bg-background/55 px-4 py-4 shadow-[var(--dashboard-shadow-sm)] transition-[border-color,background-color] hover:border-primary/45 hover:bg-background/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{DOCUMENT_ICONS[document.kind]}</span><span className="min-w-0 flex-1"><span className="block truncate text-body font-semibold text-foreground">{document.label}</span><span className="mt-0.5 block text-meta text-muted-foreground">{CLIENT_PROJECT_LINK_KIND_LABELS[document.kind]}{document.createdAt ? ` · ${formatClientProjectDate(document.createdAt)}` : ""}</span></span><ExternalLink aria-hidden className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:transform-none" />
              </a></li>
            ))}</ul>
          )}
        </section>
    </article>
  );
}
