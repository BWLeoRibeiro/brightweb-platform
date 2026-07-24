import {
  CRM_CONTACTS_DEFAULT_PAGE_SIZE,
  CRM_CONTACTS_MAX_PAGE_SIZE,
  CRM_ORGANIZATIONS_DEFAULT_PAGE_SIZE,
  CRM_ORGANIZATIONS_MAX_PAGE_SIZE,
  CRM_STATUS_TIMELINE_DEFAULT_LIMIT,
  CRM_STATUS_TIMELINE_MAX_LIMIT,
  getCrmContactStatusStats,
  getCrmReportData,
  listCrmContacts,
  listCrmOrganizations,
  listCrmOwnerOptions,
  listCrmStatusTimeline,
} from "./data";
import {
  MAX_BULK_OPERATION_IDS,
  publicError,
  sanitizePublicError,
  validateBoundedUuidBatch,
} from "@brightweblabs/infra/robustness";
import {
  bulkSetCrmContactStatus,
  createCrmContact,
  deleteCrmContact,
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
    sort: (["date_desc", "name", "company"] as const).find((sort) => sort === url.searchParams.get("sort")) ?? "date_desc",
  };
}

export function parseCrmTimelineRequest(request: Request | URL | string) {
  const url = request instanceof URL ? request : new URL(typeof request === "string" ? request : request.url);
  const sinceValue = url.searchParams.get("since")?.trim();
  const sinceDate = sinceValue ? new Date(sinceValue) : null;
  return {
    contactId: url.searchParams.get("contactId")?.trim() || undefined,
    limit: Math.min(
      parsePositiveInteger(url.searchParams.get("limit"), CRM_STATUS_TIMELINE_DEFAULT_LIMIT),
      CRM_STATUS_TIMELINE_MAX_LIMIT,
    ),
    since: sinceDate && Number.isFinite(sinceDate.getTime()) ? sinceDate.toISOString() : undefined,
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
  listTimeline: typeof listCrmStatusTimeline;
  getReport: typeof getCrmReportData;
  createContact: typeof createCrmContact;
  updateContact: typeof updateCrmContact;
  setContactStatus: typeof bulkSetCrmContactStatus;
  deleteContact: typeof deleteCrmContact;
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

function contactIdsFromPayload(payload: Record<string, unknown>) {
  const singleId = payload.contactId ?? payload.id;
  const value = Array.isArray(payload.contactIds)
    ? payload.contactIds
    : singleId == null
      ? []
      : [singleId];
  return validateBoundedUuidBatch(value);
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
    : json(publicError("FORBIDDEN", "Forbidden."), { status: 403 });
}

const CRM_DOMAIN_ERRORS = {
  "A CRM contact with this email already exists.": {
    code: "DUPLICATE_EMAIL",
    message: "A CRM contact with this email already exists.",
  },
  "CRM contact not found.": { code: "CONTACT_NOT_FOUND", message: "CRM contact not found." },
  CRM_REPORT_TOO_LARGE: {
    code: "CRM_REPORT_TOO_LARGE",
    message: "The CRM report is too large to generate safely.",
  },
} as const;

function crmErrorResponse(error: unknown, context: string, status = 500) {
  const message = error instanceof Error ? error.message : "";
  if (
    message === "A first name, last name, or email is required."
    || message === "Invalid email address."
    || message === "Invalid phone number. Include the country calling code."
    || message === "At least one CRM contact field must be provided."
    || message.startsWith("Invalid CRM status.")
  ) {
    return json(publicError("INVALID_INPUT", message), { status: 400 });
  }
  const envelope = sanitizePublicError(
    error,
    CRM_DOMAIN_ERRORS,
    "CRM request could not be completed.",
    context,
  );
  const code = envelope.error.code;
  const resolvedStatus = code === "DUPLICATE_EMAIL"
    ? 409
    : code === "CONTACT_NOT_FOUND"
      ? 404
      : code === "CRM_REPORT_TOO_LARGE"
        ? 503
        : status;
  return json(envelope, { status: resolvedStatus });
}

function invalidBatchResponse(
  batch: Exclude<ReturnType<typeof validateBoundedUuidBatch>, { ok: true }>,
) {
  if (batch.code === "BATCH_TOO_LARGE") {
    return json(
      publicError("BATCH_TOO_LARGE", `A maximum of ${MAX_BULK_OPERATION_IDS} IDs is allowed per request.`),
      { status: 400 },
    );
  }
  if (batch.code === "INVALID_UUID") {
    return json(publicError("INVALID_UUID", "Every ID must be a valid UUID."), { status: 400 });
  }
  return json(publicError("BATCH_REQUIRED", "At least one contact ID is required."), { status: 400 });
}

function withUserAccess(
  dependencies: CrmHttpDependencies,
  action: (supabase: unknown, request: Request) => Promise<Response>,
) {
  return async (request: Request) => {
    const access = await dependencies.getAccess();
    if (!access.ok) {
      return json(publicError("ACCESS_DENIED", access.error), { status: access.status });
    }

    try {
      return await action(access.supabase, request);
    } catch (error) {
      return crmErrorResponse(error, "crm.read");
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

export function createCrmTimelineGetHandler(dependencies: CrmHttpDependencies) {
  return withUserAccess(dependencies, async (supabase, request) => {
    const result = await dependencies.listTimeline(supabase as never, parseCrmTimelineRequest(request));
    return json(result);
  });
}

export function createCrmReportGetHandler(dependencies: CrmHttpDependencies) {
  return withUserAccess(dependencies, async (supabase) => {
    return json(await dependencies.getReport(supabase as never));
  });
}

export function createCrmContactsPostHandler(dependencies: CrmHttpDependencies) {
  return async function handleCrmContactsPostRequest(request: Request): Promise<Response> {
    const access = await dependencies.getAccess();
    if (!access.ok) return json(publicError("ACCESS_DENIED", access.error), { status: access.status });
    const forbidden = requireStaffAccess(access);
    if (forbidden) return forbidden;

    const payload = await parseJsonObject(request);
    if (!payload) return json(publicError("INVALID_PAYLOAD", "Invalid JSON object payload."), { status: 400 });

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
      return crmErrorResponse(error, "crm.create");
    }
  };
}

export function createCrmContactsPatchHandler(dependencies: CrmHttpDependencies) {
  return async function handleCrmContactsPatchRequest(request: Request): Promise<Response> {
    const access = await dependencies.getAccess();
    if (!access.ok) return json(publicError("ACCESS_DENIED", access.error), { status: access.status });
    const forbidden = requireStaffAccess(access);
    if (forbidden) return forbidden;

    const payload = await parseJsonObject(request);
    if (!payload) return json(publicError("INVALID_PAYLOAD", "Invalid JSON object payload."), { status: 400 });

    const contactBatch = contactIdsFromPayload(payload);
    if (!contactBatch.ok) return invalidBatchResponse(contactBatch);
    const contactIds = contactBatch.ids;

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
      return json(publicError("EMPTY_UPDATE", "At least one contact field or status is required."), { status: 400 });
    }
    if (hasContactPatch && contactIds.length > 1) {
      return json(publicError("UNSUPPORTED_BULK_UPDATE", "Bulk updates only support CRM status changes."), { status: 400 });
    }

    try {
      let contact = hasContactPatch
        ? await dependencies.updateContact(access.supabase as never, contactIds[0], patch, {
            actorProfileId: access.profileId ?? null,
          })
        : null;

      if (status) {
        const outcomes = await dependencies.setContactStatus(
          access.supabase as never,
          contactIds,
          status as CrmContactStatus,
          reason,
          { actorProfileId: access.profileId ?? null },
        );
        return json({
          data: {
            ...(hasContactPatch ? { contact } : {}),
            outcomes,
            summary: {
              requested: outcomes.length,
              succeeded: outcomes.filter((outcome) => outcome.ok).length,
              failed: outcomes.filter((outcome) => !outcome.ok).length,
            },
          },
        });
      }

      return json({ data: { contact } });
    } catch (error) {
      return crmErrorResponse(error, "crm.update");
    }
  };
}

export function createCrmContactsDeleteHandler(dependencies: CrmHttpDependencies) {
  return async function handleCrmContactsDeleteRequest(request: Request): Promise<Response> {
    const access = await dependencies.getAccess();
    if (!access.ok) return json(publicError("ACCESS_DENIED", access.error), { status: access.status });
    const forbidden = requireStaffAccess(access);
    if (forbidden) return forbidden;
    const payload = await parseJsonObject(request);
    if (!payload) return json(publicError("INVALID_PAYLOAD", "Invalid JSON object payload."), { status: 400 });
    const contactBatch = contactIdsFromPayload(payload);
    if (!contactBatch.ok) return invalidBatchResponse(contactBatch);
    const outcomes: Array<{ id: string; ok: boolean; code?: "CONTACT_NOT_FOUND" | "WRITE_FAILED" }> = [];
    for (const contactId of contactBatch.ids) {
      try {
        await dependencies.deleteContact(
          access.supabase as never,
          contactId,
          { actorProfileId: access.profileId ?? null },
        );
        outcomes.push({ id: contactId, ok: true });
      } catch (error) {
        console.error("[crm.bulk-delete]", { contactId, error });
        outcomes.push({
          id: contactId,
          ok: false,
          code: error instanceof Error && error.message === "CRM contact not found."
            ? "CONTACT_NOT_FOUND"
            : "WRITE_FAILED",
        });
      }
    }
    return json({
      data: {
        outcomes,
        summary: {
          requested: outcomes.length,
          succeeded: outcomes.filter((outcome) => outcome.ok).length,
          failed: outcomes.filter((outcome) => !outcome.ok).length,
        },
      },
    });
  };
}
