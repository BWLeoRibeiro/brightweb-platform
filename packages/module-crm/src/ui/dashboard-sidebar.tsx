"use client";

import { ArrowUpRight, Building2, Clock, Expand } from "lucide-react";
import { Badge, Button, SectionHeading, Skeleton, SurfaceCard } from "@brightweblabs/ui";

import type { CrmStatusLog } from "../data";
import { defaultCrmUiDictionary } from "./dictionary";
import { CrmTimeline } from "./timeline";
import type { CrmOrganization, CrmUiDictionary } from "./types";

const CRM_SIDEBAR_SURFACE =
  "rounded-[var(--radius-card)] border border-hairline bg-elevate-1 shadow-none";

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
              <Button type="button" variant="ghost" size="icon-sm" className="size-8 rounded-full border border-hairline bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onOpenTimeline} aria-label={dictionary.timeline.expand}>
                <Expand className="size-3.5" aria-hidden />
              </Button>
            }
          />
        </div>
        <div className="px-4 pb-4 pt-0">
          {isRefreshing && timelineEntries.length === 0 ? (
            <div className="space-y-3 py-1">
              {[0, 1, 2].map((index) => <Skeleton key={index} className="h-10 w-full rounded-[var(--radius-card)]" />)}
            </div>
          ) : null}
          {!isRefreshing && timelineEntries.length === 0 ? <p className="text-ui-micro text-muted-foreground">{dictionary.timeline.emptyHint}</p> : null}
          {timelineEntries.length > 0 ? <CrmTimeline entries={timelineEntries.slice(0, 3)} dictionary={dictionary} embedded /> : null}
        </div>
      </SurfaceCard>

      <SurfaceCard className={`${CRM_SIDEBAR_SURFACE} self-start p-0`}>
        <div className="px-4 pb-2 pt-4">
          <SectionHeading
            icon={Building2}
            title={dictionary.organizations.title}
            subtitle={dictionary.organizations.subtitle}
            action={
              <Button type="button" variant="ghost" size="icon-sm" className="size-8 rounded-full border border-hairline bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onOpenOrganizations} aria-label={dictionary.organizations.expand}>
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
                  <p className="truncate text-ui-body font-semibold leading-tight text-foreground">{organization.name}</p>
                  <p className="mt-0.5 text-ui-micro leading-tight text-muted-foreground">{organization.industry ?? dictionary.organizations.industry}</p>
                  {websiteHref ? (
                    <a href={websiteHref} target="_blank" rel="noreferrer" className="group mt-1 inline-flex max-w-full items-center gap-1 text-ui-micro leading-tight text-muted-foreground hover:text-foreground hover:underline">
                      <span className="truncate">{organization.website_url}</span>
                      <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </a>
                  ) : <p className="mt-1 text-ui-micro leading-tight text-muted-foreground">{dictionary.report.noWebsite}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant="outline" className="h-6 min-w-6 justify-center rounded-full border-hairline bg-transparent px-2 text-ui-micro font-semibold text-muted-foreground">
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
