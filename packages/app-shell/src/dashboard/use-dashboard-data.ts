"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createLatestRequestController, isAbortError } from "@brightweblabs/infra/request-observability";
import {
  parseDashboardCrmResponse,
  parseDashboardOverviewShellResponse,
  parseDashboardProjectsResponse,
  parseDashboardTasksResponse,
} from "./dashboard-response-parser";
import { createDashboardRequestGenerations, type DashboardRequestGeneration } from "./dashboard-request-generations";
import {
  clearDashboardSectionErrors,
  setDashboardSectionError,
  type DashboardSectionErrors,
} from "./dashboard-section-errors";
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
  isTasksLoadingMore: boolean;
  errors: DashboardSectionErrors;
  ensureTasks: () => void;
  loadMoreTasks: () => void;
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
  const [isTasksLoadingMore, setIsTasksLoadingMore] = useState(false);
  const [errors, setErrors] = useState<DashboardSectionErrors>({});
  const generationsRef = useRef(createDashboardRequestGenerations());
  const tasksRequestRef = useRef<Promise<boolean> | null>(null);
  const tasksPageRequestRef = useRef<Promise<boolean> | null>(null);
  const overviewRequestController = useRef(createLatestRequestController());
  const projectsRequestController = useRef(createLatestRequestController());
  const crmRequestController = useRef(createLatestRequestController());
  const tasksRequestController = useRef(createLatestRequestController());
  const tasksPageRequestController = useRef(createLatestRequestController());

  const loadTasks = useCallback(async ({
    force = false,
    generation,
  }: {
    force?: boolean;
    generation?: DashboardRequestGeneration;
  } = {}) => {
    if (!hasTasks) return false;
    if (!force && tasksRequestRef.current) return tasksRequestRef.current;
    tasksPageRequestController.current.abort();
    setIsTasksLoadingMore(false);
    const requestGeneration = generation ?? generationsRef.current.begin(["tasks"]);
    const latest = tasksRequestController.current.begin();
    setErrors((current) => clearDashboardSectionErrors(current, ["tasks"]));
    setIsTasksLoading(true);
    let request: Promise<boolean>;
    request = client.getTasks({ signal: latest.signal }).then((payload) => {
      const parsed = parseDashboardTasksResponse(payload);
      if (!parsed.data) throw new Error(parsed.error ?? messages.tasksUnavailable);
      if (!generationsRef.current.isCurrent(requestGeneration, "tasks")) return false;
      setTasks(parsed.data);
      return true;
    }).catch((error) => {
      if (isAbortError(error) || !latest.isCurrent()) return false;
      if (generationsRef.current.isCurrent(requestGeneration, "tasks")) {
        setErrors((current) => setDashboardSectionError(current, "tasks", messages.tasksUnavailable));
      }
      return false;
    }).finally(() => {
      const current = latest.isCurrent();
      latest.finish();
      if (tasksRequestRef.current === request) tasksRequestRef.current = null;
      if (current && generationsRef.current.isCurrent(requestGeneration, "tasks")) setIsTasksLoading(false);
    });
    tasksRequestRef.current = request;
    return request;
  }, [client, hasTasks, messages.tasksUnavailable]);

  const loadMoreTasks = useCallback(async () => {
    if (!hasTasks || !tasks?.pagination.hasMore || tasksPageRequestRef.current) return false;
    const expectedPage = tasks.pagination.page + 1;
    const latest = tasksPageRequestController.current.begin();
    setErrors((current) => clearDashboardSectionErrors(current, ["tasks"]));
    setIsTasksLoadingMore(true);
    let request: Promise<boolean>;
    request = client.getTasks({
      signal: latest.signal,
      page: expectedPage,
      pageSize: tasks.pagination.pageSize,
    }).then((payload) => {
      const parsed = parseDashboardTasksResponse(payload);
      if (!parsed.data) throw new Error(parsed.error ?? messages.tasksUnavailable);
      if (!latest.isCurrent() || parsed.data.pagination.page !== expectedPage) return false;
      setTasks((current) => {
        if (!current || current.pagination.page >= parsed.data!.pagination.page) return current;
        const existingIds = new Set(current.tasks.map((task) => task.id));
        return {
          ...parsed.data!,
          tasks: [...current.tasks, ...parsed.data!.tasks.filter((task) => !existingIds.has(task.id))],
        };
      });
      return true;
    }).catch((error) => {
      if (isAbortError(error) || !latest.isCurrent()) return false;
      setErrors((current) => setDashboardSectionError(current, "tasks", messages.tasksUnavailable));
      return false;
    }).finally(() => {
      const current = latest.isCurrent();
      latest.finish();
      if (tasksPageRequestRef.current === request) tasksPageRequestRef.current = null;
      if (current) setIsTasksLoadingMore(false);
    });
    tasksPageRequestRef.current = request;
    return request;
  }, [client, hasTasks, messages.tasksUnavailable, tasks]);

  const load = useCallback(async (options: { notify?: boolean; sections?: DashboardRefreshEventDetail["sections"] } = {}) => {
    const requested = normalizeDashboardRefreshSections(options.sections).filter((section) => sections.includes(section));
    const shouldProjects = requested.includes("projects");
    const shouldCrm = requested.includes("crm");
    const shouldTasks = requested.includes("tasks");
    const generation = generationsRef.current.begin(requested);
    setErrors((current) => clearDashboardSectionErrors(current, requested));
    if (shouldProjects) setIsProjectsLoading(true);
    if (shouldCrm) setIsCrmLoading(true);
    const tasksResult = shouldTasks ? loadTasks({ force: true, generation }) : null;

    const results: boolean[] = [];
    if (shouldProjects && shouldCrm && client.getOverview) {
      const latest = overviewRequestController.current.begin();
      try {
        const parsed = parseDashboardOverviewShellResponse(await client.getOverview({ signal: latest.signal }));
        if (!parsed.data) throw new Error(parsed.error ?? messages.dashboardError);
        if (!latest.isCurrent()) return;
        const projectsCurrent = generationsRef.current.isCurrent(generation, "projects");
        const crmCurrent = generationsRef.current.isCurrent(generation, "crm");
        if (projectsCurrent) setProjects(parsed.data.projects);
        if (crmCurrent) setCrm(parsed.data.crm);
        results.push(projectsCurrent, crmCurrent);
      } catch (error) {
        if (isAbortError(error) || !latest.isCurrent()) return;
        const fallbacks: Promise<boolean>[] = [];
        if (generationsRef.current.isCurrent(generation, "projects")) {
          const projectsLatest = projectsRequestController.current.begin();
          fallbacks.push(client.getProjects({ signal: projectsLatest.signal }).then(parseDashboardProjectsResponse).then((parsed) => {
            if (!parsed.data) throw new Error();
            if (!projectsLatest.isCurrent() || !generationsRef.current.isCurrent(generation, "projects")) return false;
            setProjects(parsed.data);
            return true;
          }).catch((fallbackError) => {
            if (isAbortError(fallbackError) || !projectsLatest.isCurrent()) return false;
            if (generationsRef.current.isCurrent(generation, "projects")) {
              setErrors((current) => setDashboardSectionError(current, "projects", messages.projectsUnavailable));
            }
            return false;
          }).finally(() => projectsLatest.finish()));
        }
        if (generationsRef.current.isCurrent(generation, "crm")) {
          const crmLatest = crmRequestController.current.begin();
          fallbacks.push(client.getCrm({ signal: crmLatest.signal }).then(parseDashboardCrmResponse).then((parsed) => {
            if (!parsed.data) throw new Error();
            if (!crmLatest.isCurrent() || !generationsRef.current.isCurrent(generation, "crm")) return false;
            setCrm(parsed.data);
            return true;
          }).catch((fallbackError) => {
            if (isAbortError(fallbackError) || !crmLatest.isCurrent()) return false;
            if (generationsRef.current.isCurrent(generation, "crm")) {
              setErrors((current) => setDashboardSectionError(current, "crm", messages.crmUnavailable));
            }
            return false;
          }).finally(() => crmLatest.finish()));
        }
        const fallbackResults = await Promise.all(fallbacks);
        results.push(...fallbackResults);
      } finally {
        const current = latest.isCurrent();
        latest.finish();
        if (current && generationsRef.current.isCurrent(generation, "projects")) setIsProjectsLoading(false);
        if (current && generationsRef.current.isCurrent(generation, "crm")) setIsCrmLoading(false);
      }
    } else {
      const sectionResults: Promise<boolean>[] = [];
      if (shouldProjects) {
        const latest = projectsRequestController.current.begin();
        sectionResults.push(client.getProjects({ signal: latest.signal }).then(parseDashboardProjectsResponse).then((parsed) => {
          if (!parsed.data) throw new Error();
          if (!latest.isCurrent() || !generationsRef.current.isCurrent(generation, "projects")) return false;
          setProjects(parsed.data); return true;
        }).catch((error) => {
          if (isAbortError(error) || !latest.isCurrent()) return false;
          if (generationsRef.current.isCurrent(generation, "projects")) {
            setErrors((current) => setDashboardSectionError(current, "projects", messages.projectsUnavailable));
          }
          return false;
        }).finally(() => {
          const current = latest.isCurrent();
          latest.finish();
          if (current && generationsRef.current.isCurrent(generation, "projects")) setIsProjectsLoading(false);
        }));
      }
      if (shouldCrm) {
        const latest = crmRequestController.current.begin();
        sectionResults.push(client.getCrm({ signal: latest.signal }).then(parseDashboardCrmResponse).then((parsed) => {
          if (!parsed.data) throw new Error();
          if (!latest.isCurrent() || !generationsRef.current.isCurrent(generation, "crm")) return false;
          setCrm(parsed.data); return true;
        }).catch((error) => {
          if (isAbortError(error) || !latest.isCurrent()) return false;
          if (generationsRef.current.isCurrent(generation, "crm")) {
            setErrors((current) => setDashboardSectionError(current, "crm", messages.crmUnavailable));
          }
          return false;
        }).finally(() => {
          const current = latest.isCurrent();
          latest.finish();
          if (current && generationsRef.current.isCurrent(generation, "crm")) setIsCrmLoading(false);
        }));
      }
      results.push(...await Promise.all(sectionResults));
    }
    if (tasksResult) results.push(await tasksResult);
    if (options.notify && results.length && results.every(Boolean)) onNotify?.(messages.updated);
  }, [client, loadTasks, messages, onNotify, sections]);

  useEffect(() => {
    const missing = sections.filter((section) => !initialData?.[section]);
    if (missing.length) void load({ sections: missing });
  }, []); // Initial availability and data are intentionally captured once.

  useEffect(() => () => {
    overviewRequestController.current.abort();
    projectsRequestController.current.abort();
    crmRequestController.current.abort();
    tasksRequestController.current.abort();
    tasksPageRequestController.current.abort();
  }, []);

  const refresh = useCallback(() => { void load({ notify: true }); }, [load]);
  useDashboardRefreshEvents({
    isRefreshing: isProjectsLoading || isCrmLoading || isTasksLoading,
    onRefresh: useCallback((detail?: DashboardRefreshEventDetail) => { void load({ sections: detail?.sections }); }, [load]),
  });

  return {
    projects,
    crm,
    tasks,
    isProjectsLoading,
    isCrmLoading,
    isTasksLoading,
    isTasksLoadingMore,
    errors,
    ensureTasks: () => { void loadTasks(); },
    loadMoreTasks: () => { void loadMoreTasks(); },
    refresh,
  };
}
