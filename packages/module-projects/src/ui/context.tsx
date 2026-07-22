"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createProjectsUiClient } from "./client";
import { defaultProjectsUiDictionary } from "./dictionary";
import type { ProjectsNavigationConfig, ProjectsUiClient, ProjectsUiDictionary } from "./types";

const ClientContext = createContext<ProjectsUiClient | null>(null);
const DictionaryContext = createContext<ProjectsUiDictionary>(defaultProjectsUiDictionary);
const NavigationContext = createContext<ProjectsNavigationConfig>({ listHref: "/projects", detailHref: (id) => `/projects/${id}`, boardHref: (id) => `/projects/${id}/tasks`, organizationHref: () => "/crm" });

export function ProjectsUiProvider({ client, dictionary = defaultProjectsUiDictionary, navigation, children }: { client?: ProjectsUiClient; dictionary?: ProjectsUiDictionary; navigation?: Partial<ProjectsNavigationConfig>; children: ReactNode }) {
  const resolvedClient = useMemo(() => client ?? createProjectsUiClient(), [client]);
  const resolvedNavigation = useMemo(() => ({ listHref: navigation?.listHref ?? "/projects", detailHref: navigation?.detailHref ?? ((id: string) => `/projects/${id}`), boardHref: navigation?.boardHref ?? ((id: string) => `/projects/${id}/tasks`), organizationHref: navigation?.organizationHref ?? (() => "/crm") }), [navigation]);
  return <ClientContext.Provider value={resolvedClient}><DictionaryContext.Provider value={dictionary}><NavigationContext.Provider value={resolvedNavigation}>{children}</NavigationContext.Provider></DictionaryContext.Provider></ClientContext.Provider>;
}

export function useProjectsUiClient() { const value = useContext(ClientContext); if (!value) throw new Error("useProjectsUiClient must be used inside ProjectsUiProvider."); return value; }
export function useProjectsUiDictionary() { return useContext(DictionaryContext); }
export function useProjectsNavigation() { return useContext(NavigationContext); }
