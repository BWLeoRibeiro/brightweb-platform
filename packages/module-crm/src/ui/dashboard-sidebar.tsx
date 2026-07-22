"use client";

import { ArrowUpRight, Building2, Clock, Expand } from "lucide-react";
import { Badge, Button, SectionHeading, Skeleton, SkeletonCircle, SurfaceCard } from "@brightweblabs/ui";

import type { CrmStatusLog } from "../data";
import { defaultCrmUiDictionary } from "./dictionary";
import { CrmActivityCard } from "./activity-card";
import type { CrmOrganization, CrmUiDictionary } from "./types";

const CRM_SIDEBAR_SURFACE =
  "rounded-[var(--radius-card)] border border-border-hairline bg-[color:var(--project-surface-secondary)] shadow-none";

export type CrmDashboardSidebarProps = {
  timelineEntries: CrmStatusLog[];
  organizations: CrmOrganization[];
  contactsByOrganization: ReadonlyMap<string, number>;
  isRefreshing: boolean;
  isLoadingOrganizations: boolean;
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
  dictionary = defaultCrmUiDictionary,
  onOpenTimeline,
  onOpenOrganizations,
  onOpenOrganization,
}: CrmDashboardSidebarProps) {
  return (
    <div className="min-w-0 space-y-[18px] self-start md:col-span-1">
      <SurfaceCard className={`${CRM_SIDEBAR_SURFACE} self-start p-0`}>
        <div className="px-4 pb-2 pt-4">
          <SectionHeading
            icon={Clock}
            title={dictionary.timeline.title}
            subtitle={dictionary.timeline.subtitle}
            action={
              <Button type="button" variant="ghost" size="icon-sm" className="size-8 rounded-full border border-border-hairline-soft bg-transparent text-foreground/55 hover:bg-[color:var(--muted)] hover:text-foreground" onClick={onOpenTimeline} aria-label={dictionary.timeline.expand}>
                <Expand className="size-3.5" aria-hidden />
              </Button>
            }
          />
        </div>
        <div className="px-4 pb-4 pt-0">
          {isRefreshing && timelineEntries.length === 0 ? (
            <div className="space-y-3 py-1">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex items-center gap-3">
                  <SkeletonCircle size="1.75rem" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton rounded="999px" className="h-[0.55rem] w-[55%]" />
                    <Skeleton rounded="999px" className="h-[0.5rem] w-[32%]" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {!isRefreshing && timelineEntries.length === 0 ? <p className="paragraph-mini text-[color:var(--muted-foreground)]">{dictionary.timeline.emptyHint}</p> : null}
          <ol className="flex flex-col pl-[10px]">
            {timelineEntries.slice(0, 3).map((entry, index, list) => (
              <CrmActivityCard key={entry.id} item={entry} isLast={index === list.length - 1} locale={dictionary.locale} dictionary={dictionary.activity} systemActor={dictionary.timeline.systemActor} />
            ))}
          </ol>
        </div>
      </SurfaceCard>

      <SurfaceCard className={`${CRM_SIDEBAR_SURFACE} self-start p-0`}>
        <div className="px-4 pb-2 pt-4">
          <SectionHeading
            icon={Building2}
            title={dictionary.organizations.title}
            subtitle={dictionary.organizations.subtitle}
            action={
              <Button type="button" variant="ghost" size="icon-sm" className="size-8 rounded-full border border-border-hairline-soft bg-transparent text-foreground/55 hover:bg-[color:var(--muted)] hover:text-foreground" onClick={onOpenOrganizations} aria-label={dictionary.organizations.expand}>
                <Expand className="size-3.5" aria-hidden />
              </Button>
            }
          />
        </div>
        <div className="space-y-1 px-4 pb-4 pt-0">
          {organizations.slice(0, 4).map((organization) => {
            const websiteHref = organization.website_url
              ? organization.website_url.startsWith("http://") || organization.website_url.startsWith("https://")
                ? organization.website_url
                : `https://${organization.website_url}`
              : null;
            return (
              <div key={organization.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] px-2.5 py-2 transition-colors hover:bg-muted">
                <div className="min-w-0">
                  <p className="truncate paragraph-small font-semibold leading-tight text-[color:var(--foreground)]">{organization.name}</p>
                  <p className="mt-0.5 paragraph-mini leading-tight text-[color:var(--muted-foreground)]">{organization.industry ?? dictionary.organizations.industry}</p>
                  {websiteHref ? (
                    <a href={websiteHref} target="_blank" rel="noreferrer" className="group mt-1 inline-flex max-w-full items-center gap-1 paragraph-mini leading-tight text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:underline">
                      <span className="truncate">{organization.website_url}</span>
                      <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </a>
                  ) : <p className="mt-1 paragraph-mini leading-tight text-[color:var(--muted-foreground)]">{dictionary.report.noWebsite}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant="outline" className="h-6 min-w-6 justify-center rounded-full border-border-hairline-soft bg-transparent px-2 text-[11px] font-semibold text-[color:var(--muted-foreground)]">
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
            <div className="space-y-2 px-2.5 py-2">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-10 w-full rounded-[var(--radius-card)]" />)}</div>
          ) : null}
          {!isLoadingOrganizations && organizations.length === 0 ? <p className="px-2.5 py-4 text-ui-micro text-muted-foreground">{dictionary.organizations.emptyTitle}</p> : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
