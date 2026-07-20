import {
  CRM_CONTACTS_DEFAULT_PAGE_SIZE,
  CRM_CONTACTS_MAX_PAGE_SIZE,
  CRM_ORGANIZATIONS_DEFAULT_PAGE_SIZE,
  CRM_ORGANIZATIONS_MAX_PAGE_SIZE,
  getCrmContactStatusStats,
  listCrmContacts,
  listCrmOrganizations,
  listCrmOwnerOptions,
} from "./data";
import { ptCrmActivityDictionary } from "./activity-messages";
import {
  bulkSetCrmContactStatus,
  createCrmContact,
  updateCrmContact,
  type CreateCrmContactInput,
  type CrmContactStatus,
  type UpdateCrmContactInput,
} from "./server";

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
    profileId?: string;
    role?: string | null;
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
  createContact: typeof createCrmContact;
  updateContact: typeof updateCrmContact;
  setContactStatus: typeof bulkSetCrmContactStatus;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function nullableString(payload: Record<string, unknown>, key: string): string | null | undefined {
  if (!hasOwn(payload, key)) return undefined;
  return optionalString(payload[key]);
}

function contactIdsFromPayload(payload: Record<string, unknown>): string[] {
  if (Array.isArray(payload.contactIds)) {
    return Array.from(new Set(payload.contactIds
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)));
  }

  const id = optionalString(payload.contactId) ?? optionalString(payload.id);
  return id ? [id] : [];
}

async function parseJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const payload = await request.json();
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

function requireStaffAccess(access: Extract<ServerUserAccess, { ok: true }>): Response | null {
  return access.role === "staff" || access.role === "admin"
    ? null
    : json({ error: "Forbidden." }, { status: 403 });
}

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
        { error: error instanceof Error ? error.message : ptCrmActivityDictionary.summaries?.loadFailed ?? "crm_data_load_failed" },
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

export function createCrmContactsPostHandler(dependencies: CrmHttpDependencies) {
  return async function handleCrmContactsPostRequest(request: Request): Promise<Response> {
    const access = await dependencies.getAccess();
    if (!access.ok) return json({ error: access.error }, { status: access.status });
    const forbidden = requireStaffAccess(access);
    if (forbidden) return forbidden;

    const payload = await parseJsonObject(request);
    if (!payload) return json({ error: "Invalid JSON object payload." }, { status: 400 });

    const input: CreateCrmContactInput = {
      firstName: optionalString(payload.firstName),
      lastName: optionalString(payload.lastName),
      email: optionalString(payload.email),
      phone: optionalString(payload.phone),
      status: (optionalString(payload.status) ?? undefined) as CrmContactStatus | undefined,
      source: optionalString(payload.source),
      organizationId: optionalString(payload.organizationId),
      ownerId: optionalString(payload.ownerId) ?? access.profileId ?? null,
    };

    try {
      const contact = await dependencies.createContact(access.supabase as never, input, {
        actorProfileId: access.profileId ?? null,
      });
      return json({ data: { contact } }, { status: 201 });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "CRM contact could not be created." }, { status: 400 });
    }
  };
}

export function createCrmContactsPatchHandler(dependencies: CrmHttpDependencies) {
  return async function handleCrmContactsPatchRequest(request: Request): Promise<Response> {
    const access = await dependencies.getAccess();
    if (!access.ok) return json({ error: access.error }, { status: access.status });
    const forbidden = requireStaffAccess(access);
    if (forbidden) return forbidden;

    const payload = await parseJsonObject(request);
    if (!payload) return json({ error: "Invalid JSON object payload." }, { status: 400 });

    const contactIds = contactIdsFromPayload(payload);
    if (contactIds.length === 0) return json({ error: "A contact ID is required." }, { status: 400 });

    const status = optionalString(payload.status);
    const reason = optionalString(payload.statusReason) ?? optionalString(payload.reason);
    const patch: UpdateCrmContactInput = {};
    if (hasOwn(payload, "firstName")) patch.firstName = nullableString(payload, "firstName");
    if (hasOwn(payload, "lastName")) patch.lastName = nullableString(payload, "lastName");
    if (hasOwn(payload, "email")) patch.email = nullableString(payload, "email");
    if (hasOwn(payload, "phone")) patch.phone = nullableString(payload, "phone");
    if (hasOwn(payload, "source")) patch.source = nullableString(payload, "source");
    if (hasOwn(payload, "organizationId")) patch.organizationId = nullableString(payload, "organizationId");
    if (hasOwn(payload, "ownerId")) patch.ownerId = nullableString(payload, "ownerId");
    const hasContactPatch = Object.keys(patch).length > 0;

    if (!hasContactPatch && !status) {
      return json({ error: "At least one contact field or status is required." }, { status: 400 });
    }
    if (hasContactPatch && contactIds.length > 1) {
      return json({ error: "Bulk updates only support CRM status changes." }, { status: 400 });
    }

    try {
      let contact = hasContactPatch
        ? await dependencies.updateContact(access.supabase as never, contactIds[0], patch, {
            actorProfileId: access.profileId ?? null,
          })
        : null;

      if (status) {
        const contacts = await dependencies.setContactStatus(
          access.supabase as never,
          contactIds,
          status as CrmContactStatus,
          reason,
          { actorProfileId: access.profileId ?? null },
        );
        if (contactIds.length === 1) contact = contacts[0] ?? contact;
      }

      return contactIds.length === 1
        ? json({ data: { contact } })
        : json({ data: { updatedIds: contactIds } });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "CRM contacts could not be updated." }, { status: 400 });
    }
  };
}
