import {
  CRM_CONTACTS_DEFAULT_PAGE_SIZE,
  CRM_CONTACTS_MAX_PAGE_SIZE,
  CRM_ORGANIZATIONS_DEFAULT_PAGE_SIZE,
  CRM_ORGANIZATIONS_MAX_PAGE_SIZE,
  getCrmContactStatusStats,
  listCrmContacts,
  listCrmOrganizations,
  listCrmOwnerOptions,
} from "./data.ts";

export function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseCrmContactsRequest(request: Request | URL | string) {
  const url = request instanceof URL ? request : new URL(typeof request === "string" ? request : request.url);

  return {
    page: parsePositiveInteger(url.searchParams.get("page"), 1),
    pageSize: Math.min(
      parsePositiveInteger(url.searchParams.get("pageSize"), CRM_CONTACTS_DEFAULT_PAGE_SIZE),
      CRM_CONTACTS_MAX_PAGE_SIZE,
    ),
    search: url.searchParams.get("search")?.trim() ?? "",
    status: url.searchParams.get("status")?.trim() || null,
    organizationId: url.searchParams.get("organizationId")?.trim() || null,
    ownerProfileId: url.searchParams.get("ownerProfileId")?.trim() || null,
  };
}

export function parseCrmOrganizationsRequest(request: Request | URL | string) {
  const url = request instanceof URL ? request : new URL(typeof request === "string" ? request : request.url);

  return {
    page: parsePositiveInteger(url.searchParams.get("page"), 1),
    pageSize: Math.min(
      parsePositiveInteger(url.searchParams.get("pageSize"), CRM_ORGANIZATIONS_DEFAULT_PAGE_SIZE),
      CRM_ORGANIZATIONS_MAX_PAGE_SIZE,
    ),
    search: url.searchParams.get("search")?.trim() ?? "",
  };
}

type ServerUserAccess =
  | {
    ok: true;
    supabase: unknown;
  }
  | {
    ok: false;
    status: number;
    error: string;
  };

type CrmHttpDependencies = {
  getAccess: () => Promise<ServerUserAccess>;
  listContacts: typeof listCrmContacts;
  listOrganizations: typeof listCrmOrganizations;
  getStats: typeof getCrmContactStatusStats;
  listOwners: typeof listCrmOwnerOptions;
};

function withUserAccess(
  dependencies: CrmHttpDependencies,
  action: (supabase: unknown, request: Request) => Promise<Response>,
) {
  return async (request: Request) => {
    const access = await dependencies.getAccess();
    if (!access.ok) {
      return json({ error: access.error }, { status: access.status });
    }

    try {
      return await action(access.supabase, request);
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Não foi possível carregar dados CRM." },
        { status: 500 },
      );
    }
  };
}

export function createCrmContactsGetHandler(dependencies: CrmHttpDependencies) {
  return withUserAccess(dependencies, async (supabase, request) => {
    const params = parseCrmContactsRequest(request);
    const result = await dependencies.listContacts(supabase as never, params);
    return json(result);
  });
}

export function createCrmOrganizationsGetHandler(dependencies: CrmHttpDependencies) {
  return withUserAccess(dependencies, async (supabase, request) => {
    const params = parseCrmOrganizationsRequest(request);
    const result = await dependencies.listOrganizations(supabase as never, params);
    return json(result);
  });
}

export function createCrmStatsGetHandler(dependencies: CrmHttpDependencies) {
  return withUserAccess(dependencies, async (supabase) => {
    const result = await dependencies.getStats(supabase as never);
    return json(result);
  });
}

export function createCrmOwnersGetHandler(dependencies: CrmHttpDependencies) {
  return withUserAccess(dependencies, async (supabase) => {
    const result = await dependencies.listOwners(supabase as never);
    return json(result);
  });
}
