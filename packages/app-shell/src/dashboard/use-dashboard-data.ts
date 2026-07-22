"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseDashboardCrmResponse,
  parseDashboardOverviewShellResponse,
  parseDashboardProjectsResponse,
  parseDashboardTasksResponse,
} from "./dashboard-response-parser";
import { normalizeDashboardRefreshSections, type DashboardRefreshEventDetail } from "./events";
import { useDashboardRefreshEvents } from "./hooks/use-dashboard-refresh-events";
import type { DashboardCrmData, DashboardDataClient, DashboardInitialData, DashboardProjectsData, DashboardSection, DashboardTasksData } from "./types";

export type DashboardState = {
  projects: DashboardProjectsData | null;
  crm: DashboardCrmData | null;
  tasks: DashboardTasksData | null;
  isProjectsLoading: boolean;
  isCrmLoading: boolean;
  isTasksLoading: boolean;
  error: string | null;
  ensureTasks: () => void;
  refresh: () => void;
};

type DashboardDataMessages = {
  dashboardError: string;
  projectsUnavailable: string;
  crmUnavailable: string;
  tasksUnavailable: string;
  updated: string;
};

export function useDashboardData({
  client,
  initialData,
  sections,
  messages,
  onNotify,
}: {
  client: DashboardDataClient;
  initialData?: DashboardInitialData;
  sections: DashboardSection[];
  messages: DashboardDataMessages;
  onNotify?: (message: string) => void;
}): DashboardState {
  const hasProjects = sections.includes("projects");
  const hasCrm = sections.includes("crm");
  const hasTasks = sections.includes("tasks");
  const [projects, setProjects] = useState<DashboardProjectsData | null>(initialData?.projects ?? null);
  const [crm, setCrm] = useState<DashboardCrmData | null>(initialData?.crm ?? null);
  const [tasks, setTasks] = useState<DashboardTasksData | null>(initialData?.tasks ?? null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(hasProjects && !initialData?.projects);
  const [isCrmLoading, setIsCrmLoading] = useState(hasCrm && !initialData?.crm);
  const [isTasksLoading, setIsTasksLoading] = useState(hasTasks && !initialData?.tasks);
  const [error, setError] = useState<string | null>(null);
  const tasksRequestRef = useRef<Promise<void> | null>(null);

  const loadTasks = useCallback(async () => {
    if (!hasTasks || tasksRequestRef.current) return tasksRequestRef.current;
    setIsTasksLoading(true);
    const request = client.getTasks().then((payload) => {
      const parsed = parseDashboardTasksResponse(payload);
      if (!parsed.data) throw new Error(parsed.error ?? messages.tasksUnavailable);
      setTasks(parsed.data);
    }).catch(() => setError((current) => current ?? messages.tasksUnavailable)).finally(() => {
      tasksRequestRef.current = null;
      setIsTasksLoading(false);
    });
    tasksRequestRef.current = request;
    return request;
  }, [client, hasTasks, messages.tasksUnavailable]);

  const load = useCallback(async (options: { notify?: boolean; sections?: DashboardRefreshEventDetail["sections"] } = {}) => {
    const requested = normalizeDashboardRefreshSections(options.sections).filter((section) => sections.includes(section));
    const shouldProjects = requested.includes("projects");
    const shouldCrm = requested.includes("crm");
    const shouldTasks = requested.includes("tasks");
    setError(null);
    if (shouldProjects) setIsProjectsLoading(true);
    if (shouldCrm) setIsCrmLoading(true);

    const results: boolean[] = [];
    if (shouldProjects && shouldCrm) {
      try {
        const parsed = parseDashboardOverviewShellResponse(await client.getOverview());
        if (!parsed.data) throw new Error(parsed.error ?? messages.dashboardError);
        setProjects(parsed.data.projects);
        setCrm(parsed.data.crm);
        results.push(true, true);
      } catch {
        const fallbacks = await Promise.all([
          client.getProjects().then(parseDashboardProjectsResponse).then((parsed) => {
            if (!parsed.data) throw new Error();
            setProjects(parsed.data);
            return true;
          }).catch(() => { setError((current) => current ?? messages.projectsUnavailable); return false; }),
          client.getCrm().then(parseDashboardCrmResponse).then((parsed) => {
            if (!parsed.data) throw new Error();
            setCrm(parsed.data);
            return true;
          }).catch(() => { setError((current) => current ?? messages.crmUnavailable); return false; }),
        ]);
        results.push(...fallbacks);
      } finally {
        setIsProjectsLoading(false);
        setIsCrmLoading(false);
      }
    } else {
      if (shouldProjects) {
        results.push(await client.getProjects().then(parseDashboardProjectsResponse).then((parsed) => {
          if (!parsed.data) throw new Error();
          setProjects(parsed.data); return true;
        }).catch(() => { setError((current) => current ?? messages.projectsUnavailable); return false; }).finally(() => setIsProjectsLoading(false)));
      }
      if (shouldCrm) {
        results.push(await client.getCrm().then(parseDashboardCrmResponse).then((parsed) => {
          if (!parsed.data) throw new Error();
          setCrm(parsed.data); return true;
        }).catch(() => { setError((current) => current ?? messages.crmUnavailable); return false; }).finally(() => setIsCrmLoading(false)));
      }
    }
    if (shouldTasks) { await loadTasks(); results.push(true); }
    if (options.notify && results.length && results.every(Boolean)) onNotify?.(messages.updated);
  }, [client, loadTasks, messages, onNotify, sections]);

  useEffect(() => {
    const missing = sections.filter((section) => !initialData?.[section]);
    if (missing.length) void load({ sections: missing });
  }, []); // Initial availability and data are intentionally captured once.

  const refresh = useCallback(() => { void load({ notify: true }); }, [load]);
  useDashboardRefreshEvents({
    isRefreshing: isProjectsLoading || isCrmLoading || isTasksLoading,
    onRefresh: useCallback((detail?: DashboardRefreshEventDetail) => { void load({ sections: detail?.sections }); }, [load]),
  });

  return { projects, crm, tasks, isProjectsLoading, isCrmLoading, isTasksLoading, error, ensureTasks: () => { void loadTasks(); }, refresh };
}
