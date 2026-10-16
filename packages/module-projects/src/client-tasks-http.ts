import { publicError } from "@brightweblabs/infra/robustness";
import {
  CLIENT_TASK_LIMITS,
  ClientTaskBoundaryError,
  isClientTaskUuid,
  parseClientTaskActionRequest,
  parseStaffClientTaskActionRequest,
} from "./client-tasks-contracts";
import type {
  actOnClientProjectTask,
  getProjectClientTaskWorkbench,
  listClientProjectTasks,
  manageProjectClientTask,
} from "./client-tasks";

type Access =
  | { ok: true; supabase: unknown; profileId?: string; role?: string | null }
  | { ok: false; status: number; error: string };
type AuthorizedAccess = Extract<Access, { ok: true }>;
type RouteContext = { params: Promise<{ id: string; itemId?: string }> };
export type ClientTasksHttpDependencies = {
  getAccess: () => Promise<Access>;
  listClientProjectTasks: typeof listClientProjectTasks;
  actOnClientProjectTask: typeof actOnClientProjectTask;
  getProjectClientTaskWorkbench: typeof getProjectClientTaskWorkbench;
  manageProjectClientTask: typeof manageProjectClientTask;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
      "vary": "Cookie, Authorization",
    },
  });
}

function errorResponse(error: unknown): Response {
  const failure = error instanceof ClientTaskBoundaryError
    ? error
    : new ClientTaskBoundaryError("REQUEST_FAILED", 500);
  const messages = {
    INVALID_INPUT: "Invalid client task request.",
    FORBIDDEN: "Forbidden.",
    NOT_FOUND: "Task not found or unavailable.",
    CONFLICT: "The task has changed. Refresh it before trying again.",
    MIGRATION_REQUIRED: "Client task database migration is required. Apply the projects client-task migration before using this feature.",
    INVALID_RESPONSE: "Client task response could not be validated.",
    REQUEST_FAILED: "Client task request could not be completed.",
  };
  return json(publicError(failure.code, messages[failure.code]), failure.status);
}

async function parseBody(request: Request): Promise<unknown> {
  const declaredSize = request.headers.get("content-length");
  if (declaredSize !== null && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > CLIENT_TASK_LIMITS.bodyBytes)) {
    throw new ClientTaskBoundaryError("INVALID_INPUT", 413);
  }
  if (!request.body) throw new ClientTaskBoundaryError("INVALID_INPUT", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > CLIENT_TASK_LIMITS.bodyBytes) {
        await reader.cancel();
        throw new ClientTaskBoundaryError("INVALID_INPUT", 413);
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ClientTaskBoundaryError("INVALID_INPUT", 400);
  }
}

function boundary(
  dependencies: ClientTasksHttpDependencies,
  role: "client" | "staff",
  action: (access: AuthorizedAccess, request: Request, params: { id: string; itemId?: string }) => Promise<Response>,
) {
  return async (request: Request, context: RouteContext): Promise<Response> => {
    try {
      const access = await dependencies.getAccess();
      if (!access.ok) return json(publicError("ACCESS_DENIED", "Access could not be validated."), access.status);
      const allowedRole = role === "client" ? access.role === "client" : access.role === "admin" || access.role === "staff";
      if (!allowedRole || !access.profileId) throw new ClientTaskBoundaryError("FORBIDDEN", 403);
      const params = await context.params;
      if (!isClientTaskUuid(params.id) || (params.itemId !== undefined && !isClientTaskUuid(params.itemId))) {
        throw new ClientTaskBoundaryError("INVALID_INPUT", 400);
      }
      return await action(access, request, params);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function createClientProjectTasksGetHandler(dependencies: ClientTasksHttpDependencies) {
  return boundary(dependencies, "client", async (access, _request, { id }) =>
    json({ data: await dependencies.listClientProjectTasks(access.supabase as never, id) }));
}

export function createClientProjectTaskPostHandler(dependencies: ClientTasksHttpDependencies) {
  return boundary(dependencies, "client", async (access, request, { id, itemId }) => {
    if (!itemId) throw new ClientTaskBoundaryError("INVALID_INPUT", 400);
    const input = parseClientTaskActionRequest(await parseBody(request));
    return json({ data: await dependencies.actOnClientProjectTask(access.supabase as never, id, itemId, input) });
  });
}

export function createProjectClientTasksGetHandler(dependencies: ClientTasksHttpDependencies) {
  return boundary(dependencies, "staff", async (access, _request, { id }) =>
    json({ data: await dependencies.getProjectClientTaskWorkbench(access.supabase as never, id) }));
}

export function createProjectClientTasksPostHandler(dependencies: ClientTasksHttpDependencies) {
  return boundary(dependencies, "staff", async (access, request, { id }) => {
    const input = parseStaffClientTaskActionRequest(await parseBody(request));
    if (input.action !== "create") throw new ClientTaskBoundaryError("INVALID_INPUT", 400);
    return json({ data: await dependencies.manageProjectClientTask(access.supabase as never, id, null, input) }, 201);
  });
}

export function createProjectClientTaskPatchHandler(dependencies: ClientTasksHttpDependencies) {
  return boundary(dependencies, "staff", async (access, request, { id, itemId }) => {
    if (!itemId) throw new ClientTaskBoundaryError("INVALID_INPUT", 400);
    const input = parseStaffClientTaskActionRequest(await parseBody(request));
    if (input.action === "create") throw new ClientTaskBoundaryError("INVALID_INPUT", 400);
    return json({ data: await dependencies.manageProjectClientTask(access.supabase as never, id, itemId, input) });
  });
}
