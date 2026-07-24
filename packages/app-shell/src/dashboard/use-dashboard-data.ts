"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseDashboardCrmResponse,
  parseDashboardOverviewShellResponse,
  parseDashboardProjectsResponse,
  parseDashboardTasksResponse,
} from "./dashboard-response-parser";
import { createDashboardRequestGenerations, type DashboardRequestGeneration } from "./dashboard-request-generations";
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
  const generationsRef = useRef(createDashboardRequestGenerations());
  const tasksRequestRef = useRef<Promise<boolean> | null>(null);

  const loadTasks = useCallback(async ({
    force = false,
    generation,
  }: {
    force?: boolean;
    generation?: DashboardRequestGeneration;
  } = {}) => {
    if (!hasTasks) return false;
    if (!force && tasksRequestRef.current) return tasksRequestRef.current;
    const requestGeneration = generation ?? generationsRef.current.begin(["tasks"]);
    setIsTasksLoading(true);
    let request: Promise<boolean>;
    request = client.getTasks().then((payload) => {
      const parsed = parseDashboardTasksResponse(payload);
      if (!parsed.data) throw new Error(parsed.error ?? messages.tasksUnavailable);
      if (!generationsRef.current.isCurrent(requestGeneration, "tasks")) return false;
      setTasks(parsed.data);
      return true;
    }).catch(() => {
      if (generationsRef.current.isCurrent(requestGeneration, "tasks")) {
        setError((current) => current ?? messages.tasksUnavailable);
      }
      return false;
    }).finally(() => {
      if (tasksRequestRef.current === request) tasksRequestRef.current = null;
      if (generationsRef.current.isCurrent(requestGeneration, "tasks")) setIsTasksLoading(false);
    });
    tasksRequestRef.current = request;
    return request;
  }, [client, hasTasks, messages.tasksUnavailable]);

  const load = useCallback(async (options: { notify?: boolean; sections?: DashboardRefreshEventDetail["sections"] } = {}) => {
    const requested = normalizeDashboardRefreshSections(options.sections).filter((section) => sections.includes(section));
    const shouldProjects = requested.includes("projects");
    const shouldCrm = requested.includes("crm");
    const shouldTasks = requested.includes("tasks");
    const generation = generationsRef.current.begin(requested);
    setError(null);
    if (shouldProjects) setIsProjectsLoading(true);
    if (shouldCrm) setIsCrmLoading(true);
    const tasksResult = shouldTasks ? loadTasks({ force: true, generation }) : null;

    const results: boolean[] = [];
    if (shouldProjects && shouldCrm) {
      try {
        const parsed = parseDashboardOverviewShellResponse(await client.getOverview());
        if (!parsed.data) throw new Error(parsed.error ?? messages.dashboardError);
        const projectsCurrent = generationsRef.current.isCurrent(generation, "projects");
        const crmCurrent = generationsRef.current.isCurrent(generation, "crm");
        if (projectsCurrent) setProjects(parsed.data.projects);
        if (crmCurrent) setCrm(parsed.data.crm);
        results.push(projectsCurrent, crmCurrent);
      } catch {
        const fallbacks: Promise<boolean>[] = [];
        if (generationsRef.current.isCurrent(generation, "projects")) {
          fallbacks.push(client.getProjects().then(parseDashboardProjectsResponse).then((parsed) => {
            if (!parsed.data) throw new Error();
            if (!generationsRef.current.isCurrent(generation, "projects")) return false;
            setProjects(parsed.data);
            return true;
          }).catch(() => {
            if (generationsRef.current.isCurrent(generation, "projects")) {
              setError((current) => current ?? messages.projectsUnavailable);
            }
            return false;
          }));
        }
        if (generationsRef.current.isCurrent(generation, "crm")) {
          fallbacks.push(client.getCrm().then(parseDashboardCrmResponse).then((parsed) => {
            if (!parsed.data) throw new Error();
            if (!generationsRef.current.isCurrent(generation, "crm")) return false;
            setCrm(parsed.data);
            return true;
          }).catch(() => {
            if (generationsRef.current.isCurrent(generation, "crm")) {
              setError((current) => current ?? messages.crmUnavailable);
            }
            return false;
          }));
        }
        const fallbackResults = await Promise.all(fallbacks);
        results.push(...fallbackResults);
      } finally {
        if (generationsRef.current.isCurrent(generation, "projects")) setIsProjectsLoading(false);
        if (generationsRef.current.isCurrent(generation, "crm")) setIsCrmLoading(false);
      }
    } else {
      if (shouldProjects) {
        results.push(await client.getProjects().then(parseDashboardProjectsResponse).then((parsed) => {
          if (!parsed.data) throw new Error();
          if (!generationsRef.current.isCurrent(generation, "projects")) return false;
          setProjects(parsed.data); return true;
        }).catch(() => {
          if (generationsRef.current.isCurrent(generation, "projects")) {
            setError((current) => current ?? messages.projectsUnavailable);
          }
          return false;
        }).finally(() => {
          if (generationsRef.current.isCurrent(generation, "projects")) setIsProjectsLoading(false);
        }));
      }
      if (shouldCrm) {
        results.push(await client.getCrm().then(parseDashboardCrmResponse).then((parsed) => {
          if (!parsed.data) throw new Error();
          if (!generationsRef.current.isCurrent(generation, "crm")) return false;
          setCrm(parsed.data); return true;
        }).catch(() => {
          if (generationsRef.current.isCurrent(generation, "crm")) {
            setError((current) => current ?? messages.crmUnavailable);
          }
          return false;
        }).finally(() => {
          if (generationsRef.current.isCurrent(generation, "crm")) setIsCrmLoading(false);
        }));
      }
    }
    if (tasksResult) results.push(await tasksResult);
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
