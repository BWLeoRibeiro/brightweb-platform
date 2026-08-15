"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Clock3, RefreshCw } from "lucide-react";
import {
  sheetBodyClassName,
  sheetShellClassName,
} from "./constants";
import { AppSheetHeader } from "./shared/app-sheet";
import { ActivityChangeRows } from "./shared/activity-change-rows";
import { monoTabularClassName as MONO } from "./shared/typography";
import { ProjectOwnerAvatar } from "./shared/project-owner-avatar";
import { ProjectSurfaceSectionHeader } from "./shared/project-surface-card";
import {
  CompactCollectionHeaderActions,
  compactCollectionRevealClassName,
} from "./shared/compact-collection";
import { getCompactCollectionPreview } from "./shared/compact-collection-model";
import {
  Button,
  Sheet,
  SheetContent,
} from "@brightweblabs/ui";
import { toActivityChanges } from "@brightweblabs/ui/activity-format";
import { ActivityMessage } from "@brightweblabs/ui";
import { activityActorName, composeProjectMessage } from "../activity-messages";
import type { ProjectActivityItem } from "../types";
import { useProjectsUiClient, useProjectsUiDictionary } from "./context";
import { formatProjectDateTime } from "./shared/formatters";

type ProjectRecentActivityProps = {
  projectId: string;
  activity: ProjectActivityItem[];
  total: number;
};

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
          <p className="text-body text-foreground min-w-0 flex-1 leading-snug"><ActivityMessage segs={message} /></p>
          <span className={`${MONO} text-micro text-muted-foreground shrink-0 text-right`}>
            {formatProjectDateTime(item.createdAt)}
          </span>
        </div>
        <ActivityChangeRows changes={changes} />
      </div>
    </li>
  );
}

export function ProjectRecentActivity({ projectId, activity, total }: ProjectRecentActivityProps) {
  const client = useProjectsUiClient();
  const dictionary = useProjectsUiDictionary();
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [fullActivity, setFullActivity] = useState(activity);
  const [fullPage, setFullPage] = useState(1);
  const [fullTotal, setFullTotal] = useState(total);
  const [isLoadingFull, setLoadingFull] = useState(false);
  const [hasFullError, setHasFullError] = useState(false);
  const previewItems = getCompactCollectionPreview(activity);

  useEffect(() => {
    if (isSheetOpen) return;
    setFullActivity(activity);
    setFullTotal(total);
    setFullPage(1);
  }, [activity, isSheetOpen, total]);

  const loadFullPage = useCallback(async (page: number, append: boolean) => {
    setLoadingFull(true);
    setHasFullError(false);
    try {
      const result = client.queryProjectActivity
        ? await client.queryProjectActivity(projectId, { page, pageSize: 50 })
        : await client.listProjectActivity(projectId).then((items) => ({
          items,
          page: 1,
          pageSize: items.length || 1,
          total: items.length,
          totalPages: 1,
        }));
      setFullActivity((current) => {
        if (!append) return result.items;
        const itemsById = new Map(current.map((item) => [item.id, item]));
        result.items.forEach((item) => itemsById.set(item.id, item));
        return Array.from(itemsById.values());
      });
      setFullPage(result.page);
      setFullTotal(result.total);
    } catch {
      setHasFullError(true);
    } finally {
      setLoadingFull(false);
    }
  }, [client, projectId]);

  const handleSheetChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) return;
    if (total <= activity.length) {
      setFullActivity(activity);
      setFullTotal(total);
      setFullPage(1);
      return;
    }
    void loadFullPage(1, false);
  };

  return (
    <>
      <ProjectSurfaceSectionHeader
        icon={Clock3}
        title={dictionary.detail.recentActivity}
        subtitle={dictionary.detail.recentActivitySubtitle}
        rightSlot={<CompactCollectionHeaderActions total={total} collectionLabel={dictionary.detail.recentActivity} expandLabel={dictionary.detail.expandActivity} onExpand={() => handleSheetChange(true)} />}
      />

      {activity.length === 0 ? (
        <p className={`${compactCollectionRevealClassName} text-meta text-muted-foreground mt-4 px-1 py-2`}>{dictionary.detail.noActivity}</p>
      ) : (
        <ul className={`${compactCollectionRevealClassName} mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border)]`}>
          {previewItems.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      <Sheet open={isSheetOpen} onOpenChange={handleSheetChange}>
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader
            icon={Activity}
            title={<>{dictionary.detail.fullActivity}</>}
            description={<>{dictionary.detail.fullActivityDescription}</>}
          />
          <div className={sheetBodyClassName} aria-busy={isLoadingFull} aria-live="polite">
            {fullActivity.length === 0 && !isLoadingFull && !hasFullError ? (
              <p className="text-meta text-muted-foreground px-1 py-2">{dictionary.detail.noActivity}</p>
            ) : fullActivity.length > 0 ? (
              <ul className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border)]">
                {fullActivity.map((item) => (
                  <ActivityRow key={item.id} item={item} showDetails />
                ))}
              </ul>
            ) : null}
            {hasFullError ? (
              <div className="mt-3 flex items-center gap-3" role="alert">
                <p className="text-meta text-destructive">{dictionary.detail.activityError}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void loadFullPage(fullPage, false)}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {dictionary.actions.retry}
                </Button>
              </div>
            ) : null}
            {fullActivity.length < fullTotal ? (
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full"
                disabled={isLoadingFull}
                onClick={() => void loadFullPage(fullPage + 1, true)}
              >
                {isLoadingFull ? dictionary.detail.loading : dictionary.detail.loadMoreActivity}
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
