"use client";

import { ArrowUpRight, Building2, Clock, Expand } from "lucide-react";
import { Badge, Button, SectionHeading, Skeleton, SkeletonCircle, SurfaceCard } from "@brightweblabs/ui";

import type { CrmStatusLog } from "../data";
import { defaultCrmUiDictionary } from "./dictionary";
import { CrmActivityCard } from "./activity-card";
import type { CrmOrganization, CrmUiDictionary } from "./types";

const CRM_CONTENT_REVEAL =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200";

export type CrmDashboardSidebarProps = {
  timelineEntries: CrmStatusLog[];
  organizations: CrmOrganization[];
  contactsByOrganization: ReadonlyMap<string, number>;
  isRefreshing: boolean;
  isLoadingOrganizations: boolean;
  timelineUnavailable?: boolean;
  organizationsUnavailable?: boolean;
  dictionary?: CrmUiDictionary;
  onOpenTimeline: () => void;
  onOpenOrganizations: () => void;
  onOpenOrganization: (organization: CrmOrganization) => void;
};

export function CrmDashboardSidebar({
  timelineEntries,
  organizations,
  contactsByOrganization,
  isRefreshing,
  isLoadingOrganizations,
  timelineUnavailable = false,
  organizationsUnavailable = false,
  dictionary = defaultCrmUiDictionary,
  onOpenTimeline,
  onOpenOrganizations,
  onOpenOrganization,
}: CrmDashboardSidebarProps) {
  return (
    <div className="min-w-0 space-y-[var(--crm-sidebar-gap)] self-start md:col-span-1">
      <SurfaceCard aria-busy={isRefreshing} density="none" className="self-start bg-[color:var(--project-surface-secondary)] p-0 shadow-none">
        <div className="px-4 pb-2 pt-4">
          <SectionHeading
            icon={Clock}
            title={dictionary.timeline.title}
            subtitle={dictionary.timeline.subtitle}
            action={
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="h-6 min-w-8 justify-center rounded-full border-border-hairline-soft bg-transparent px-2 text-data-sm font-semibold text-[color:var(--muted-foreground)]" aria-label={isRefreshing && timelineEntries.length === 0 ? dictionary.stats.loading : `${timelineEntries.length} ${dictionary.timeline.title}`}>
                  {isRefreshing && timelineEntries.length === 0 ? "…" : timelineEntries.length}
                </Badge>
                <Button type="button" variant="ghost" size="icon-sm" className="size-8 rounded-full border border-border-hairline-soft bg-transparent text-foreground/55 hover:bg-[color:var(--muted)] hover:text-foreground" onClick={onOpenTimeline} aria-label={dictionary.timeline.expand}>
                  <Expand className="size-3.5" aria-hidden />
                </Button>
              </div>
            }
          />
        </div>
        <div className="min-h-10 px-4 pb-4 pt-0">
          {isRefreshing && timelineEntries.length === 0 ? (
            <div className="flex h-10 items-center">
              <div className="flex w-full items-center gap-3">
                <SkeletonCircle size="1.75rem" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton rounded="var(--radius-pill)" className="h-[var(--skeleton-line-height-compact)] w-[55%]" />
                  <Skeleton rounded="var(--radius-pill)" className="h-[var(--skeleton-line-height-xs)] w-[32%]" />
                </div>
              </div>
            </div>
          ) : null}
          {timelineUnavailable && timelineEntries.length === 0 ? <p role="alert" className="min-h-12 text-meta text-destructive">{dictionary.dashboard.loadError}</p> : null}
          {!isRefreshing && !timelineUnavailable && timelineEntries.length === 0 ? <p className={`${CRM_CONTENT_REVEAL} flex min-h-10 items-center text-meta text-[color:var(--muted-foreground)]`}>{dictionary.timeline.emptyHint}</p> : null}
          {timelineEntries.length > 0 ? (
            <ol className={`${CRM_CONTENT_REVEAL} h-10 overflow-hidden pl-[var(--timeline-list-inset)]`}>
              {timelineEntries.slice(0, 1).map((entry) => (
                <CrmActivityCard key={entry.id} item={entry} isLast compact locale={dictionary.locale} dictionary={dictionary.activity} systemActor={dictionary.timeline.systemActor} />
              ))}
            </ol>
          ) : null}
        </div>
      </SurfaceCard>

      <SurfaceCard aria-busy={isLoadingOrganizations} density="none" className="self-start bg-[color:var(--project-surface-secondary)] p-0 shadow-none">
        <div className="px-4 pb-2 pt-4">
          <SectionHeading
            icon={Building2}
            title={dictionary.organizations.title}
            subtitle={dictionary.organizations.subtitle}
            action={
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="h-6 min-w-8 justify-center rounded-full border-border-hairline-soft bg-transparent px-2 text-data-sm font-semibold text-[color:var(--muted-foreground)]" aria-label={isLoadingOrganizations && organizations.length === 0 ? dictionary.stats.loading : `${organizations.length} ${dictionary.organizations.title}`}>
                  {isLoadingOrganizations && organizations.length === 0 ? "…" : organizations.length}
                </Badge>
                <Button type="button" variant="ghost" size="icon-sm" className="size-8 rounded-full border border-border-hairline-soft bg-transparent text-foreground/55 hover:bg-[color:var(--muted)] hover:text-foreground" onClick={onOpenOrganizations} aria-label={dictionary.organizations.expand}>
                  <Expand className="size-3.5" aria-hidden />
                </Button>
              </div>
            }
          />
        </div>
        <div className="min-h-20 px-4 pb-4 pt-0">
          {organizations.slice(0, 1).map((organization) => {
            const websiteHref = organization.website_url
              ? organization.website_url.startsWith("http://") || organization.website_url.startsWith("https://")
                ? organization.website_url
                : `https://${organization.website_url}`
              : null;
            return (
              <div key={organization.id} className={`${CRM_CONTENT_REVEAL} flex h-16 items-center justify-between gap-3 overflow-hidden rounded-[var(--radius-card)] px-2.5 py-2 transition-colors hover:bg-muted`}>
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold leading-tight text-[color:var(--foreground)]">{organization.name}</p>
                  <p className="mt-0.5 text-meta leading-tight text-[color:var(--muted-foreground)]">{organization.industry ?? dictionary.organizations.industry}</p>
                  {websiteHref ? (
                    <a href={websiteHref} target="_blank" rel="noreferrer" className="group mt-1 inline-flex max-w-full items-center gap-1 text-meta leading-tight text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:underline">
                      <span className="truncate">{organization.website_url}</span>
                      <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </a>
                  ) : <p className="mt-1 text-meta leading-tight text-[color:var(--muted-foreground)]">{dictionary.report.noWebsite}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant="outline" className="h-6 min-w-6 justify-center rounded-full border-border-hairline-soft bg-transparent px-2 text-data-sm font-semibold text-[color:var(--muted-foreground)]">
                    {contactsByOrganization.get(organization.id) ?? 0}
                  </Badge>
                  <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => onOpenOrganization(organization)} aria-label={dictionary.organizations.expand}>
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            );
          })}
          {isLoadingOrganizations && organizations.length === 0 ? (
            <div className="px-2.5"><Skeleton className="h-16 w-full rounded-[var(--radius-card)]" /></div>
          ) : null}
          {organizationsUnavailable && organizations.length === 0 ? <p role="alert" className="min-h-10 px-2.5 py-4 text-micro text-destructive">{dictionary.dashboard.loadError}</p> : null}
          {!isLoadingOrganizations && !organizationsUnavailable && organizations.length === 0 ? <p className="px-2.5 py-4 text-micro text-muted-foreground">{dictionary.organizations.emptyTitle}</p> : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
