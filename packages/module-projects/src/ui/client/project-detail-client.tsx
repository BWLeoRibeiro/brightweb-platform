"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, Cloud, ExternalLink, FileText, Flag, FolderKanban, Link2, Sheet } from "lucide-react";
import { Button, Card, CoverHeader } from "@brightweblabs/ui";
import type { ClientProjectDetail } from "../../client-contracts";
import type { MilestoneStatus, ProjectLinkKind } from "../../contracts";
import { CLIENT_MILESTONE_STATUS_CLASSES, CLIENT_MILESTONE_STATUS_LABELS, CLIENT_PROJECT_LINK_KIND_LABELS, CLIENT_PROJECT_STATUS_LABELS, clientProjectsDictionary } from "./dictionary";
import { formatClientProjectDate, isClientProjectDateOverdue, resolveNextClientMeta } from "./shared";
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
      <dt className="text-micro font-semibold text-muted-foreground">{label}</dt>
      <dd className={`text-data mt-1 truncate text-body font-semibold ${emphasis ? "text-[color:var(--project-health-off-track)]" : ""}`}>{value}</dd>
    </div>
  );
}

function ProjectRoadmap({ metas, currentMetaId }: { metas: ClientProjectDetail["metas"]; currentMetaId: string | null }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentMetaRef = useRef<HTMLLIElement>(null);
  const dragRef = useRef({ pointerId: -1, startX: 0, scrollLeft: 0, hasMoved: false });
  const [isDragging, setIsDragging] = useState(false);
  const [scrollState, setScrollState] = useState({ hasOverflow: false, canScrollLeft: false, canScrollRight: false });
  const currentMetaIndex = metas.findIndex((meta) => meta.id === currentMetaId);
  const responsiveGridClass = metas.length === 1
    ? "min-w-full grid-flow-row auto-cols-auto grid-cols-1"
    : metas.length === 2
      ? "sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:min-w-0"
      : metas.length === 3
        ? "md:grid-flow-row md:auto-cols-auto md:grid-cols-3 md:min-w-0"
        : metas.length === 4
          ? "lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-4 lg:min-w-0"
          : "";

  useEffect(() => {
    const container = scrollContainerRef.current;
    const current = currentMetaRef.current;
    if (!container || !current || container.scrollWidth <= container.clientWidth) return;
    container.scrollLeft = Math.max(
      0,
      current.offsetLeft - ((container.clientWidth - current.clientWidth) * 0.38),
    );
  }, [currentMetaId, metas.length]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateScrollState = () => {
      const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
      const nextState = {
        hasOverflow: maxScrollLeft > 1,
        canScrollLeft: container.scrollLeft > 1,
        canScrollRight: container.scrollLeft < maxScrollLeft - 1,
      };
      setScrollState((previous) => (
        previous.hasOverflow === nextState.hasOverflow
        && previous.canScrollLeft === nextState.canScrollLeft
        && previous.canScrollRight === nextState.canScrollRight
          ? previous
          : nextState
      ));
    };

    updateScrollState();
    container.addEventListener("scroll", updateScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [metas.length]);

  const scrollOneStage = (direction: -1 | 1) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const stageWidth = container.querySelector("li")?.getBoundingClientRect().width ?? 240;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollBy({ left: stageWidth * direction, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const stopDragging = (pointerId: number) => {
    const container = scrollContainerRef.current;
    if (!container || dragRef.current.pointerId !== pointerId) return;
    if (container.hasPointerCapture(pointerId)) container.releasePointerCapture(pointerId);
    dragRef.current.pointerId = -1;
    dragRef.current.hasMoved = false;
    setIsDragging(false);
  };

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border/55 bg-background/55 shadow-[var(--dashboard-shadow-sm)]" aria-labelledby="client-project-milestones-title">
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-5 pt-6 sm:px-8 sm:pt-8">
        <div>
          <p className="text-label text-primary">{clientProjectsDictionary.safeUi.metas}</p>
          <h2 id="client-project-milestones-title" className="mt-1 text-heading-3 font-bold">{clientProjectsDictionary.safeUi.milestoneJourney}</h2>
          <p className="mt-2 text-body text-muted-foreground">{clientProjectsDictionary.safeUi.roadmapDescription}</p>
        </div>
        {metas.length > 0 ? (
          <div className="flex items-center gap-3">
            <p className="text-data text-meta text-muted-foreground">
              {currentMetaIndex >= 0
                ? clientProjectsDictionary.safeUi.milestonePosition(currentMetaIndex + 1, metas.length)
                : clientProjectsDictionary.safeUi.milestoneCount(metas.length)}
            </p>
            {scrollState.hasOverflow ? (
              <div className="hidden items-center gap-2 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-full"
                  aria-label={clientProjectsDictionary.safeUi.roadmapPrevious}
                  disabled={!scrollState.canScrollLeft}
                  onClick={() => scrollOneStage(-1)}
                >
                  <ChevronLeft aria-hidden className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-full"
                  aria-label={clientProjectsDictionary.safeUi.roadmapNext}
                  disabled={!scrollState.canScrollRight}
                  onClick={() => scrollOneStage(1)}
                >
                  <ChevronRight aria-hidden className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {metas.length === 0 ? (
        <p className="mx-5 mb-6 rounded-2xl border border-border/60 bg-background/50 px-5 py-8 text-body text-muted-foreground sm:mx-8 sm:mb-8">{clientProjectsDictionary.safeUi.noSharedMetas}</p>
      ) : (
        <div className="relative">
          <div
            ref={scrollContainerRef}
            tabIndex={scrollState.hasOverflow ? 0 : undefined}
            aria-label={scrollState.hasOverflow ? clientProjectsDictionary.safeUi.roadmapNavigation : undefined}
            className={`portal-scroll overflow-x-auto px-5 pb-6 pt-2 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-scrollbar]:hidden sm:px-8 sm:pb-8 ${scrollState.hasOverflow ? isDragging ? "cursor-grabbing select-none" : "cursor-grab" : ""}`}
            onPointerDown={(event) => {
              if (event.pointerType !== "mouse" || event.button !== 0 || !scrollState.hasOverflow) return;
              const container = scrollContainerRef.current;
              if (!container) return;
              dragRef.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: container.scrollLeft, hasMoved: false };
              container.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const container = scrollContainerRef.current;
              if (!container || dragRef.current.pointerId !== event.pointerId) return;
              const distance = event.clientX - dragRef.current.startX;
              if (!dragRef.current.hasMoved && Math.abs(distance) < 4) return;
              if (!dragRef.current.hasMoved) {
                dragRef.current.hasMoved = true;
                setIsDragging(true);
                window.getSelection()?.removeAllRanges();
              }
              container.scrollLeft = dragRef.current.scrollLeft - distance;
              event.preventDefault();
            }}
            onPointerUp={(event) => stopDragging(event.pointerId)}
            onPointerCancel={(event) => stopDragging(event.pointerId)}
          >
          <ol className={`grid min-w-max snap-x snap-mandatory grid-flow-col auto-cols-[15rem] border-y border-border/65 ${responsiveGridClass}`}>
            {metas.map((meta, index) => {
              const isCurrent = meta.id === currentMetaId;
              const isCompleted = meta.status === "achieved";
              const isNext = currentMetaIndex >= 0 && index === currentMetaIndex + 1;
              const formattedDate = formatClientProjectDate(meta.completedAt ?? meta.targetDate);
              const dateLabel = formattedDate === clientProjectsDictionary.common.noDate
                ? formattedDate
                : isCompleted
                  ? clientProjectsDictionary.safeUi.milestoneCompletedDate(formattedDate)
                  : isCurrent && meta.status !== "pending"
                    ? clientProjectsDictionary.safeUi.milestoneDeadlineDate(formattedDate)
                    : clientProjectsDictionary.safeUi.milestonePlannedDate(formattedDate);
              return (
                <li
                  key={meta.id}
                  ref={isCurrent ? currentMetaRef : undefined}
                  className={`relative flex min-h-56 snap-start flex-col border-r p-5 last:border-r-0 ${isCurrent ? "brand-panel border-[color:var(--project-hero-border)] text-[color:var(--project-hero-foreground)] shadow-[var(--dashboard-shadow-sm)]" : isNext ? "border-primary/35 bg-primary/[0.045] ring-1 ring-inset ring-primary/20" : isCompleted ? "border-border/45 bg-muted/10 text-muted-foreground" : "border-border/55 bg-background/25"}`}
                >
                  {isCompleted ? <span aria-hidden className="absolute -top-px inset-x-0 h-px bg-[color:var(--semantic-success)]" /> : null}
                  {isCurrent ? <span aria-hidden className="absolute -top-px left-0 h-px w-5 bg-[color:var(--semantic-success)]" /> : null}
                  <span aria-hidden className={`absolute -top-1.5 left-5 size-3 rounded-full border-2 border-background ${isCurrent ? "bg-[color:var(--accent)] ring-4 ring-[color:var(--accent)]/15" : isCompleted ? "bg-[color:var(--semantic-success)]" : isNext ? "bg-background ring-4 ring-primary/10 border-primary" : "bg-muted-foreground"}`} />
                  <div className={`flex items-center justify-between gap-3 text-micro font-bold ${isCurrent ? "text-[color:var(--project-hero-muted)]" : "text-muted-foreground"}`}>
                    <p className="text-data">{String(index + 1).padStart(2, "0")}</p>
                    <p className={`flex items-center gap-1.5 text-label ${isCurrent ? "text-[color:var(--project-hero-muted)]" : isNext ? "text-primary" : CLIENT_MILESTONE_STATUS_CLASSES[meta.status]}`}>
                      <span aria-hidden>{META_ICONS[meta.status]}</span>
                      {isNext ? clientProjectsDictionary.safeUi.milestoneUpNext : CLIENT_MILESTONE_STATUS_LABELS[meta.status]}
                    </p>
                  </div>
                  <h3 className={`mt-8 text-title font-bold leading-snug ${isCurrent ? "text-[color:var(--project-hero-foreground)]" : isCompleted ? "text-muted-foreground" : "text-foreground"}`}>{meta.title}</h3>
                  <p className={`text-data mt-auto border-t pt-3 text-meta ${isCurrent ? "border-[color:var(--project-hero-border)] text-[color:var(--project-hero-muted)]" : isNext ? "border-primary/25 text-foreground" : "border-border/60 text-muted-foreground"}`}>
                    {dateLabel}
                  </p>
                </li>
              );
            })}
          </ol>
          </div>
          {scrollState.canScrollLeft ? <span aria-hidden className="pointer-events-none absolute inset-y-2 left-0 w-10 bg-gradient-to-r from-background/90 to-transparent" /> : null}
          {scrollState.canScrollRight ? <span aria-hidden className="pointer-events-none absolute inset-y-2 right-0 w-12 bg-gradient-to-l from-background/90 to-transparent" /> : null}
        </div>
      )}
    </section>
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
  const nextMeta = resolveNextClientMeta(metas);

  return (
    <article className="space-y-8 sm:space-y-10">
      <Link href="/account/projetos" className="inline-flex min-h-11 items-center gap-1.5 text-body font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{clientProjectsDictionary.safeUi.projectsBack}</Link>

      <CoverHeader>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div className="min-w-0 space-y-4">
            <span className="-mt-8 flex size-16 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground shadow-[var(--cover-header-avatar-shadow)]">
              <FolderKanban aria-hidden className="size-6" />
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <ProjectStatusBadge status={project.status} label={CLIENT_PROJECT_STATUS_LABELS[project.status]} />
              {project.reference ? <span className="text-data text-meta text-muted-foreground">{project.reference}</span> : null}
            </div>
            <div>
              <h1 className="font-display max-w-[48rem] text-[length:var(--text-ui-preview-card-title)] font-black leading-[var(--type-leading-110)] tracking-[var(--type-tracking-n025)] sm:text-[length:var(--text-ui-dashboard-title-lg)]">{project.name}</h1>
              <p className="mt-1 text-body-lg text-muted-foreground">{project.organizations.map((organization) => organization.name).join(" · ")}</p>
            </div>
            {project.clientSummary ? (
              <section className="max-w-[46rem]" aria-labelledby="client-project-summary-title">
                <h2 id="client-project-summary-title" className="text-label font-semibold text-muted-foreground">{clientProjectsDictionary.safeUi.summary}</h2>
                <p className="mt-2 text-body-lg leading-relaxed text-foreground">{project.clientSummary}</p>
              </section>
            ) : null}
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-border/60 pt-5 sm:flex sm:flex-wrap sm:gap-x-12">
              <HeroFact label={clientProjectsDictionary.safeUi.startDate} value={formatClientProjectDate(project.startDate)} />
              <HeroFact
                label={clientProjectsDictionary.safeUi.deadline}
                value={overdue ? `${formatClientProjectDate(project.targetDate)} · ${clientProjectsDictionary.common.delayed}` : formatClientProjectDate(project.targetDate)}
                emphasis={overdue}
              />
              {project.clientContact ? <HeroFact label={clientProjectsDictionary.safeUi.contact} value={project.clientContact.email ? <a className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`mailto:${project.clientContact.email}`}>{project.clientContact.label}</a> : project.clientContact.label} /> : null}
            </dl>
          </div>
          <aside className="brand-panel rounded-[var(--radius-card)] border border-[color:var(--project-hero-border)] p-5 text-[color:var(--project-hero-foreground)] shadow-[var(--dashboard-shadow-md)]" aria-labelledby="client-project-progress-title">
            <p id="client-project-progress-title" className="text-label" style={{ color: "var(--project-hero-muted)" }}>{clientProjectsDictionary.safeUi.projectProgress}</p>
            {metas.length > 0 ? (
              <>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <p className="font-display text-[length:var(--text-ui-dashboard-title-lg)] font-black leading-none">{displayPercent ?? 0}%</p>
                  <p className="pb-1 text-right text-meta" style={{ color: "var(--project-hero-muted)" }}>{achievedCount} {clientProjectsDictionary.safeUi.of} {metas.length}</p>
                </div>
                {displayPercent !== null ? <ProjectProgressBar ariaLabel={clientProjectsDictionary.safeUi.progress} percent={displayPercent} className="mt-4" trackClassName="bg-[color:var(--project-hero-border)]" fillClassName="bg-[color:var(--accent)]" /> : null}
                {nextMeta ? (
                  <div className="mt-5 border-t border-[color:var(--project-hero-border)] pt-4">
                    <p className="flex items-center gap-2 text-label" style={{ color: "var(--project-hero-muted)" }}><Flag aria-hidden className="size-3.5 text-[color:var(--accent)]" />{clientProjectsDictionary.safeUi.nextMilestone}</p>
                    <p className="mt-2 text-body font-bold leading-snug">{nextMeta.title}</p>
                    <p className="mt-1 text-meta" style={{ color: "var(--project-hero-muted)" }}>{CLIENT_MILESTONE_STATUS_LABELS[nextMeta.status]}{nextMeta.targetDate ? ` · ${formatClientProjectDate(nextMeta.targetDate)}` : ""}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-5 border-t border-[color:var(--project-hero-border)] pt-5">
                <span className="inline-flex size-10 items-center justify-center rounded-full border border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-surface-raised)] text-[color:var(--accent)]">
                  <Flag aria-hidden className="size-4" />
                </span>
                <h2 className="mt-4 text-title font-bold leading-snug">{clientProjectsDictionary.safeUi.projectSetupTitle}</h2>
                <p className="mt-2 text-body leading-relaxed" style={{ color: "var(--project-hero-muted)" }}>{clientProjectsDictionary.safeUi.projectSetupDescription}</p>
              </div>
            )}
          </aside>
        </div>
      </CoverHeader>

      <div className="space-y-6 sm:space-y-8">
        {project.clientScope ? (
          <section className="rounded-[var(--radius-card)] border border-border/55 bg-background/55 p-6 shadow-[var(--dashboard-shadow-sm)] sm:p-8" aria-labelledby="client-project-scope-title">
            <div className="border-l-2 border-primary pl-5 sm:pl-6">
              <h2 id="client-project-scope-title" className="text-label font-semibold text-muted-foreground">{clientProjectsDictionary.safeUi.scope}</h2>
              <p className="mt-3 max-w-[44rem] whitespace-pre-line text-body leading-relaxed text-muted-foreground">{project.clientScope}</p>
            </div>
          </section>
        ) : null}

        <ProjectRoadmap metas={metas} currentMetaId={nextMeta?.id ?? null} />
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
