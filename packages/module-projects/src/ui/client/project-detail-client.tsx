"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, Circle, Clock, Cloud, ExternalLink, FileText, Link2, ListChecks, Sheet, UserRound } from "lucide-react";
import { Button, Card } from "@brightweblabs/ui";
import type { ClientProjectDetail } from "../../client-contracts";
import type { MilestoneStatus, ProjectLinkKind } from "../../contracts";
import { CLIENT_MILESTONE_STATUS_CLASSES, CLIENT_MILESTONE_STATUS_LABELS, CLIENT_PROJECT_LINK_KIND_LABELS, CLIENT_PROJECT_STATUS_LABELS, CLIENT_PROJECT_STATUS_STYLES, clientProjectsDictionary } from "./dictionary";
import { formatClientProjectDate, isClientProjectDateOverdue } from "./shared";
import { ClientProjectDetailLoading } from "./projects-loading";

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

  return (
    <article className="space-y-9">
      <Link href="/account/projetos" className="inline-flex items-center gap-1.5 text-body font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{clientProjectsDictionary.safeUi.projectsBack}</Link>

      <header className="max-w-[52rem] space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-label font-semibold ${CLIENT_PROJECT_STATUS_STYLES[project.status]}`}>{CLIENT_PROJECT_STATUS_LABELS[project.status]}</span>
          {project.reference ? <span className="text-data text-meta text-muted-foreground">{project.reference}</span> : null}
        </div>
        <h1 className="font-display text-heading-1 font-black leading-[var(--type-leading-096)] tracking-[var(--type-tracking-n040)]">{project.name}</h1>
        <p className="text-body text-muted-foreground">{project.organizations.map((organization) => organization.name).join(" · ")}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="space-y-6">
          {project.clientSummary ? (
            <section className="border-b border-border/65 pb-7">
              <p className="eyebrow text-primary">{clientProjectsDictionary.safeUi.summary}</p>
              <p className="mt-3 max-w-[48rem] text-body-lg leading-relaxed text-foreground">{project.clientSummary}</p>
            </section>
          ) : null}

          {project.clientScope ? (
            <section className="border-b border-border/65 pb-7">
              <h2 className="flex items-center gap-2 text-title font-bold"><ListChecks className="size-4 text-primary" />{clientProjectsDictionary.safeUi.scope}</h2>
              <p className="mt-3 whitespace-pre-line text-body leading-relaxed text-muted-foreground">{project.clientScope}</p>
            </section>
          ) : null}

          <section className="space-y-4">
            <div><p className="eyebrow text-primary">{clientProjectsDictionary.safeUi.progress}</p><h2 className="mt-1 text-title font-bold">{clientProjectsDictionary.safeUi.metas}</h2></div>
            {metas.length === 0 ? <p className="rounded-2xl border border-border/60 bg-background/50 px-5 py-8 text-body text-muted-foreground">{clientProjectsDictionary.safeUi.noSharedMetas}</p> : (
              <ol className="relative space-y-0 before:absolute before:bottom-5 before:left-[1.15rem] before:top-5 before:w-px before:bg-border">{metas.map((meta) => (
                <li key={meta.id} className="relative grid grid-cols-[2.35rem_minmax(0,1fr)] gap-4 py-4">
                  <span className={`z-10 inline-flex size-[2.35rem] items-center justify-center rounded-full border border-border bg-background ${CLIENT_MILESTONE_STATUS_CLASSES[meta.status]}`}>{META_ICONS[meta.status]}</span>
                  <div className="pt-1"><p className="text-body font-bold">{meta.title}</p><p className="mt-1 text-meta text-muted-foreground">{CLIENT_MILESTONE_STATUS_LABELS[meta.status]}{meta.targetDate ? ` · ${formatClientProjectDate(meta.targetDate)}` : ""}</p></div>
                </li>
              ))}</ol>
            )}
          </section>

          <section className="space-y-4 border-t border-border/65 pt-7">
            <h2 className="flex items-center gap-2 text-title font-bold"><Link2 className="size-4 text-primary" />{clientProjectsDictionary.safeUi.sharedDocuments}</h2>
            {project.documents.length === 0 ? <p className="text-body text-muted-foreground">{clientProjectsDictionary.safeUi.noSharedDocuments}</p> : (
              <ul className="grid gap-3 sm:grid-cols-2">{project.documents.map((document) => (
                <li key={document.id}><a href={document.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-4 py-4 transition-colors hover:bg-background/80">
                  <span className="text-muted-foreground">{DOCUMENT_ICONS[document.kind]}</span><span className="min-w-0 flex-1"><span className="block truncate text-body font-semibold text-primary">{document.label}</span><span className="text-meta text-muted-foreground">{CLIENT_PROJECT_LINK_KIND_LABELS[document.kind]}</span></span><ExternalLink className="size-3.5 text-muted-foreground" />
                </a></li>
              ))}</ul>
            )}
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-28">
          <Card variant="light" className="p-5 shadow-none">
            <p className="text-label font-semibold text-muted-foreground">{clientProjectsDictionary.safeUi.progress}</p>
            <p className="font-display mt-1 text-heading-2 font-black">{project.progress.percent ?? 0}%</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${project.progress.percent ?? 0}%` }} /></div>
            <p className="mt-3 text-meta text-muted-foreground">{metas.filter((meta) => meta.status === "achieved").length} {clientProjectsDictionary.safeUi.of} {metas.length} {clientProjectsDictionary.safeUi.completedMetasLower}</p>
          </Card>
          <Card variant="light" className="p-5 shadow-none">
            <h2 className="flex items-center gap-2 text-label font-semibold text-muted-foreground"><CalendarDays className="size-4" />{clientProjectsDictionary.safeUi.dates}</h2>
            <dl className="mt-4 space-y-4">
              <div><dt className="text-micro text-muted-foreground">{clientProjectsDictionary.safeUi.startDate}</dt><dd className="text-data mt-1 text-body font-semibold">{formatClientProjectDate(project.startDate)}</dd></div>
              <div><dt className="text-micro text-muted-foreground">{clientProjectsDictionary.safeUi.deadline}</dt><dd className={`text-data mt-1 text-body font-semibold ${overdue ? "text-destructive" : ""}`}>{formatClientProjectDate(project.targetDate)}</dd></div>
            </dl>
          </Card>
          {project.clientContact ? (
            <Card variant="light" className="p-5 shadow-none">
              <h2 className="flex items-center gap-2 text-label font-semibold text-muted-foreground"><UserRound className="size-4" />{clientProjectsDictionary.safeUi.contact}</h2>
              <p className="mt-3 text-body font-bold">{project.clientContact.label}</p>
              {project.clientContact.email ? <a href={`mailto:${project.clientContact.email}`} className="mt-1 block truncate text-meta text-primary hover:underline">{project.clientContact.email}</a> : null}
            </Card>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
