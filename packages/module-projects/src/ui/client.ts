import type { ListProjectsParams } from "../data";
import type { ProjectsUiClient } from "./types";

async function json<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { data?: T; error?: string } | T | null;
  if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload ? payload.error : response.statusText);
  return payload && typeof payload === "object" && "data" in payload ? payload.data as T : payload as T;
}

export function createProjectsUiClient(basePath = "/api/projects", fetcher: typeof fetch = fetch): ProjectsUiClient {
  const root = basePath.replace(/\/$/, "");
  const request = async <T>(path: string, init?: RequestInit) => json<T>(await fetcher(`${root}${path}`, init));
  const write = <T>(path: string, method: string, body?: unknown) => request<T>(path, { method, headers: body === undefined ? undefined : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return {
    requestRaw: (path, init) => fetcher(path.startsWith("http") ? path : `${root}${path.replace(/^\/api\/projects/, "")}`, init),
    async listProjects(params: ListProjectsParams = {}) { const q = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null) q.set(key, String(value)); }); return request(`?${q}`); },
    getPortfolioStats: () => request("/stats"),
    getProjectDashboard: (id) => request(`/${id}`),
    listProjectActivity: (id) => request(`/${id}/activity`),
    listOrganizations: () => request("/organizations"),
    listAssignableProfiles: (id) => request(`/${id}/members`),
    createOrganization: (input) => write("/organizations", "POST", input),
    createProject: (input) => write("", "POST", input),
    updateProject: (id, input) => write(`/${id}`, "PATCH", input),
    deleteProject: async (id) => { await write<void>(`/${id}`, "DELETE"); },
    syncProjectMembers: (id, members) => write(`/${id}/members`, "PUT", { members }),
    createMilestone: (id, input) => write(`/${id}/milestones`, "POST", input),
    updateMilestone: (id, itemId, input) => write(`/${id}/milestones/${itemId}`, "PATCH", input),
    deleteMilestone: (id, itemId) => write(`/${id}/milestones/${itemId}`, "DELETE"),
    createTask: (id, input) => write(`/${id}/tasks`, "POST", input),
    updateTask: (id, itemId, input) => write(`/${id}/tasks/${itemId}`, "PATCH", input),
    deleteTask: (id, itemId) => write(`/${id}/tasks/${itemId}`, "DELETE"),
    createLink: (id, input) => write(`/${id}/links`, "POST", input),
    updateLink: (id, itemId, input) => write(`/${id}/links/${itemId}`, "PATCH", input),
    deleteLink: (id, itemId) => write(`/${id}/links/${itemId}`, "DELETE"),
  };
}
