"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, RefreshCw } from "lucide-react";
import { ProjectRecentActivity } from "./project-recent-activity";
import { ProjectSurfaceCard, ProjectSurfaceSectionHeader } from "./shared/project-surface-card";
import { Button } from "@brightweblabs/ui";
import { Skeleton } from "@brightweblabs/ui";
import type { ProjectActivityItem } from "../types";
import { useProjectsUiClient, useProjectsUiDictionary } from "./context";

type ProjectActivityCardProps = {
  projectId: string;
  initialActivity?: ProjectActivityItem[];
  initialActivityError?: boolean;
};

export function ProjectActivityCard({ projectId, initialActivity, initialActivityError = false }: ProjectActivityCardProps) {
  const client = useProjectsUiClient();
  const dictionary = useProjectsUiDictionary();
  // When the server load failed, ignore the empty placeholder and try a client-side fetch instead.
  const hasInitialActivity = initialActivity !== undefined && !initialActivityError;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [activity, setActivity] = useState<ProjectActivityItem[]>(initialActivity ?? []);
  const [isLoading, setLoading] = useState(!hasInitialActivity);
  const [shouldLoad, setShouldLoad] = useState(hasInitialActivity);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setHasError(false);
    setLoading(true);
    setReloadKey((key) => key + 1);
    setShouldLoad(true);
  }, []);

  useEffect(() => {
    if (!hasInitialActivity) return;
    setActivity(initialActivity);
    setLoading(false);
    setShouldLoad(true);
    setHasError(false);
  }, [hasInitialActivity, initialActivity, projectId]);

  useEffect(() => {
    if (hasInitialActivity) return;
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
  }, [hasInitialActivity, shouldLoad]);

  useEffect(() => {
    if (hasInitialActivity || !shouldLoad) return;
    let isCurrent = true;
    setLoading(true);
    setHasError(false);

    void (async () => {
      try {
        const nextActivity = await client.listProjectActivity(projectId);
        if (!isCurrent) return;
        setActivity(nextActivity);
      } catch (error) {
        if (!isCurrent) return;
        console.warn("Project activity unavailable:", error);
        setHasError(true);
      } finally {
        if (isCurrent) setLoading(false);
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [client, hasInitialActivity, projectId, shouldLoad, reloadKey]);

  return (
    <div ref={cardRef} className="self-start">
      <ProjectSurfaceCard className="dashboard-reveal">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10" />
            <div className="space-y-2">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          </div>
        ) : hasError ? (
          <>
            <ProjectSurfaceSectionHeader
              icon={Clock3}
              title={dictionary.detail.recentActivity}
              subtitle={dictionary.detail.recentActivitySubtitle}
            />
            <div className="mt-4 flex flex-col items-start gap-3">
              <p className="portal-meta">
                {dictionary.detail.activityError}
              </p>
              <Button variant="outline" size="sm" onClick={retry}>
                <RefreshCw className="size-4" />
                {dictionary.actions.retry}
              </Button>
            </div>
          </>
        ) : (
          <ProjectRecentActivity activity={activity} />
        )}
      </ProjectSurfaceCard>
    </div>
  );
}
