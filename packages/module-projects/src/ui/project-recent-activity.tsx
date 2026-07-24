"use client";

import { useState } from "react";
import { Activity, Clock3, Expand } from "lucide-react";
import {
  sheetBodyClassName,
  sheetShellClassName,
} from "./constants";
import { AppSheetHeader } from "./shared/app-sheet";
import { ActivityChangeRows } from "./shared/activity-change-rows";
import { portalMonoTabularClassName as MONO } from "./shared/typography";
import { ProjectOwnerAvatar } from "./shared/project-owner-avatar";
import { ProjectSurfaceSectionHeader } from "./shared/project-surface-card";
import { SectionIconButton } from "./shared/section-icon-button";
import {
  Sheet,
  SheetContent,
} from "@brightweblabs/ui";
import { TooltipProvider } from "@brightweblabs/ui";
import { toActivityChanges } from "@brightweblabs/ui/activity-format";
import { ActivityMessage } from "@brightweblabs/ui";
import { activityActorName, composeProjectMessage } from "../activity-messages";
import type { ProjectActivityItem } from "../types";
import { useProjectsUiDictionary } from "./context";

type ProjectRecentActivityProps = {
  activity: ProjectActivityItem[];
};

const PREVIEW_ITEMS = 5;

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function getChangedByText(item: ProjectActivityItem) {
  return activityActorName(item.actorLabel ?? item.actorProfileId);
}

function ActivityRow({ item, showDetails = false }: { item: ProjectActivityItem; showDetails?: boolean }) {
  const changedBy = getChangedByText(item);
  // The message already speaks status / role / field changes inline, so the
  // detail diff rows are only worth keeping (in the sheet) for multi-field edits.
  const isStatusEvent = item.eventType.endsWith("_status_changed");
  const changes = showDetails && !isStatusEvent ? toActivityChanges(item.payload) : [];
  const message = composeProjectMessage(item, changedBy);

  return (
    <li className="group relative flex min-h-[3.25rem] items-start gap-3 border-t border-[color:var(--border)] px-3 py-2 transition-colors first:border-t-0 hover:bg-[color:var(--project-ui-color-09)]">
      <ProjectOwnerAvatar label={changedBy} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="portal-body min-w-0 flex-1 leading-snug"><ActivityMessage segs={message} /></p>
          <span className={`${MONO} portal-micro shrink-0 text-right`}>
            {formatDateTime(item.createdAt)}
          </span>
        </div>
        <ActivityChangeRows changes={changes} />
      </div>
    </li>
  );
}

export function ProjectRecentActivity({ activity }: ProjectRecentActivityProps) {
  const dictionary = useProjectsUiDictionary();
  const [isSheetOpen, setSheetOpen] = useState(false);
  const previewItems = activity.slice(0, PREVIEW_ITEMS);

  return (
    <>
      <ProjectSurfaceSectionHeader
        icon={Clock3}
        title={dictionary.detail.recentActivity}
        subtitle={dictionary.detail.recentActivitySubtitle}
        rightSlot={(
          <TooltipProvider>
            <SectionIconButton icon={Expand} label={dictionary.detail.expandActivity} onClick={() => setSheetOpen(true)} />
          </TooltipProvider>
        )}
      />

      {activity.length === 0 ? (
        <p className="portal-meta mt-4 px-1 py-2">{dictionary.detail.noActivity}</p>
      ) : (
        <ul className="portal-scroll mt-4 h-[17.75rem] rounded-[var(--radius-card)] border border-[color:var(--border)]">
          {previewItems.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader
            icon={Activity}
            title={<>{dictionary.detail.fullActivity}</>}
            description={<>{dictionary.detail.fullActivityDescription}</>}
          />
          <div className={sheetBodyClassName}>
            {activity.length === 0 ? (
              <p className="portal-meta px-1 py-2">{dictionary.detail.noActivity}</p>
            ) : (
              <ul className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border)]">
                {activity.map((item) => (
                  <ActivityRow key={item.id} item={item} showDetails />
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
