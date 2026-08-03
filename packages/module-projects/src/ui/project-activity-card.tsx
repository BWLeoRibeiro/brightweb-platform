"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, RefreshCw } from "lucide-react";
import {
  APP_ACTIVITY_REALTIME_EVENT,
  getRealtimeProjectId,
} from "@brightweblabs/app-shell";
import type { AppActivityRealtimePayload } from "@brightweblabs/infra/realtime";
import { ProjectRecentActivity } from "./project-recent-activity";
import { ProjectSurfaceCard, ProjectSurfaceSectionHeader } from "./shared/project-surface-card";
import { CompactCollectionContentSkeleton } from "./shared/compact-collection";
import { Button } from "@brightweblabs/ui";
import { Skeleton } from "@brightweblabs/ui";
import type { ProjectActivityItem } from "../types";
import { useProjectsUiClient, useProjectsUiDictionary } from "./context";

type ProjectActivityCardProps = {
  projectId: string;
  initialActivity?: ProjectActivityItem[];
  initialActivityTotal?: number;
  initialActivityError?: boolean;
};

export function ProjectActivityCard({ projectId, initialActivity, initialActivityTotal, initialActivityError = false }: ProjectActivityCardProps) {
  const client = useProjectsUiClient();
  const dictionary = useProjectsUiDictionary();
  // When the server load failed, ignore the empty placeholder and try a client-side fetch instead.
  const hasAuthoritativeInitialActivity = initialActivity !== undefined && initialActivityTotal !== undefined && !initialActivityError;
  const hasRenderableInitialActivity = !initialActivityError && ((initialActivity?.length ?? 0) > 0 || hasAuthoritativeInitialActivity);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const requestGenerationRef = useRef(0);
  const [activity, setActivity] = useState<ProjectActivityItem[]>(initialActivity ?? []);
  const [activityTotal, setActivityTotal] = useState(initialActivityTotal ?? initialActivity?.length ?? 0);
  const [isLoading, setLoading] = useState(!hasRenderableInitialActivity);
  const [shouldLoad, setShouldLoad] = useState(hasAuthoritativeInitialActivity);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadPreview = useCallback(async () => {
    if (client.queryProjectActivity) {
      return client.queryProjectActivity(projectId, { page: 1, pageSize: 3 });
    }
    const items = await client.listProjectActivity(projectId);
    return { items: items.slice(0, 3), total: items.length };
  }, [client, projectId]);

  const retry = useCallback(() => {
    setHasError(false);
    setLoading(true);
    setReloadKey((key) => key + 1);
    setShouldLoad(true);
  }, []);

  useEffect(() => {
    if (!hasAuthoritativeInitialActivity) return;
    setActivity(initialActivity);
    setActivityTotal(initialActivityTotal);
    setLoading(false);
    setShouldLoad(true);
    setHasError(false);
  }, [hasAuthoritativeInitialActivity, initialActivity, initialActivityTotal, projectId]);

  useEffect(() => {
    if (hasAuthoritativeInitialActivity) return;
    const element = cardRef.current;
    if (!element || shouldLoad) return;

    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [hasAuthoritativeInitialActivity, shouldLoad]);

  useEffect(() => {
    if (hasAuthoritativeInitialActivity || !shouldLoad) return;
    const generation = ++requestGenerationRef.current;
    let isCurrent = true;
    setLoading(true);
    setHasError(false);

    void (async () => {
      try {
        const nextActivity = await loadPreview();
        if (!isCurrent || generation !== requestGenerationRef.current) return;
        setActivity(nextActivity.items);
        setActivityTotal(nextActivity.total);
      } catch (error) {
        if (!isCurrent || generation !== requestGenerationRef.current) return;
        console.warn("Project activity unavailable:", error);
        setHasError(true);
      } finally {
        if (isCurrent) setLoading(false);
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [hasAuthoritativeInitialActivity, loadPreview, shouldLoad, reloadKey]);

  useEffect(() => {
    let isCurrent = true;
    const handleRealtimeActivity = (event: Event) => {
      const payload = (event as CustomEvent<AppActivityRealtimePayload>).detail;
      if (!payload || getRealtimeProjectId(payload) !== projectId) return;
      const generation = ++requestGenerationRef.current;
      void loadPreview()
        .then((nextActivity) => {
          if (!isCurrent || generation !== requestGenerationRef.current) return;
          setActivity(nextActivity.items);
          setActivityTotal(nextActivity.total);
          setHasError(false);
        })
        .catch((error) => {
          if (!isCurrent || generation !== requestGenerationRef.current) return;
          console.warn("Project activity realtime refresh failed:", error);
          setHasError(true);
        })
        .finally(() => {
          if (isCurrent && generation === requestGenerationRef.current) setLoading(false);
        });
    };
    window.addEventListener(APP_ACTIVITY_REALTIME_EVENT, handleRealtimeActivity);
    return () => {
      isCurrent = false;
      requestGenerationRef.current += 1;
      window.removeEventListener(APP_ACTIVITY_REALTIME_EVENT, handleRealtimeActivity);
    };
  }, [loadPreview, projectId]);

  return (
    <div ref={cardRef} className="self-start">
      <ProjectSurfaceCard className="dashboard-reveal">
        {isLoading ? (
          <div aria-busy="true" aria-label={dictionary.detail.loading}>
            <Skeleton className="h-10" />
            <CompactCollectionContentSkeleton />
          </div>
        ) : hasError ? (
          <>
            <ProjectSurfaceSectionHeader
              icon={Clock3}
              title={dictionary.detail.recentActivity}
              subtitle={dictionary.detail.recentActivitySubtitle}
            />
            <div className="mt-4 flex flex-col items-start gap-3">
              <p className="text-meta text-muted-foreground">
                {dictionary.detail.activityError}
              </p>
              <Button variant="outline" size="sm" onClick={retry}>
                <RefreshCw className="size-4" />
                {dictionary.actions.retry}
              </Button>
            </div>
          </>
        ) : (
          <ProjectRecentActivity projectId={projectId} activity={activity} total={activityTotal} />
        )}
      </ProjectSurfaceCard>
    </div>
  );
}
