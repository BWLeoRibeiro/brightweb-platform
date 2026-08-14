import type { AdminUiClient, AdminUiClientOptions, AdminUserInvitation } from "./types";
import { readPublicError } from "@brightweblabs/infra/robustness";
import { observedFetch } from "@brightweblabs/infra/request-observability";
import {
  parseAdminInvitationDeleteResponse,
  parseAdminInvitationsResponse,
  parseAdminInvitationWriteResponse,
  parseAdminRoleChangeResponse,
  parseAdminUsersResponse,
} from "./response-parsers";

async function readPayload(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readPublicError(payload, response.statusText || "Admin request failed.").message);
  return payload;
}

export function createAdminUiClient(basePath = "/api/admin/users", fetcher: typeof fetch = fetch, options: AdminUiClientOptions = {}): AdminUiClient {
  const root = basePath.replace(/\/$/, "");
  const organizationsRoot = "/api/organizations";
  const crmOrganizationsRoot = "/api/crm/organizations";

  const listOrganizations = async () => {
    const payload = await readPayload(await fetcher(`${crmOrganizationsRoot}?page=1&pageSize=100`));
    const data = payload && typeof payload === "object" && "data" in payload ? (payload as { data?: unknown }).data : null;
    const collection = data && typeof data === "object" ? data : payload;
    const items = collection && typeof collection === "object" && "items" in collection
      ? (collection as { items?: unknown }).items
      : [];
    return Array.isArray(items) ? items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      return typeof record.id === "string" && typeof record.name === "string" ? [{ id: record.id, name: record.name }] : [];
    }) : [];
  };

  const readOrganizationInvitations = async (organization: { id: string; name: string }): Promise<AdminUserInvitation[]> => {
    const payload = await readPayload(await fetcher(`${organizationsRoot}/${encodeURIComponent(organization.id)}/invitations?status=all`));
    const data = payload && typeof payload === "object" && "data" in payload ? (payload as { data?: unknown }).data : null;
    const invitations = data && typeof data === "object" && "invitations" in data ? (data as { invitations?: unknown }).invitations : [];
    return Array.isArray(invitations) ? invitations.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      if (typeof record.id !== "string" || typeof record.email !== "string") return [];
      const status: AdminUserInvitation["status"] = record.status === "accepted" || record.status === "revoked" || record.status === "expired" ? record.status : "pending";
      return [{
        id: record.id,
        email: record.email,
        role: "client" as const,
        status,
        createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
        expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : new Date().toISOString(),
        source: "organization" as const,
        organizationId: organization.id,
        organizationName: organization.name,
        organizationRole: record.role === "admin" ? "admin" as const : "member" as const,
      }];
    }) : [];
  };

  return {
    async listUsers(params, requestOptions = {}) {
      const query = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize),
      });
      if (params.search) query.set("search", params.search);
      if (params.role) query.set("role", params.role);
      return parseAdminUsersResponse(await readPayload(await observedFetch(
        fetcher,
        `${root}?${query.toString()}`,
        { signal: requestOptions.signal },
        { domain: "admin", operation: "users.list", observer: options.onRequestMetric },
      )));
    },
    async listInvitations() {
      const organizationsPromise = listOrganizations();
      const globalPromise = readPayload(await fetcher(`${root}/invitations`)).then(parseAdminInvitationsResponse);
      const [organizations, globalInvitations] = await Promise.all([organizationsPromise, globalPromise]);
      const organizationInvitations = (await Promise.all(organizations.map(readOrganizationInvitations))).flat();
      return [...globalInvitations.map((invitation) => ({ ...invitation, source: "global" as const })), ...organizationInvitations]
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    },
    listOrganizations,
    async inviteUser(input) {
      if (input.role === "client" && input.organizationId) {
        const payload = await readPayload(await fetcher(`${organizationsRoot}/${encodeURIComponent(input.organizationId)}/invitations`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ invitations: [{ email: input.email, role: input.organizationRole === "admin" ? "admin" : "member" }] }),
        }));
        const data = payload && typeof payload === "object" && "data" in payload ? (payload as { data?: unknown }).data : null;
        const invitations = data && typeof data === "object" && "invitations" in data ? (data as { invitations?: unknown }).invitations : [];
        const created = Array.isArray(invitations) ? invitations[0] : null;
        const now = new Date();
        return {
          id: created && typeof created === "object" && typeof (created as { id?: unknown }).id === "string" ? (created as { id: string }).id : `assigned-${input.email}`,
          email: input.email,
          role: "client",
          status: created ? "pending" : "accepted",
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
          source: "organization",
          organizationId: input.organizationId,
          organizationName: input.organizationName ?? null,
          organizationRole: input.organizationRole === "admin" ? "admin" : "member",
        };
      }
      return parseAdminInvitationWriteResponse(
        await readPayload(await fetcher(`${root}/invitations`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        })),
      );
    },
    async revokeInvitation(invitation) {
      if (invitation.source === "organization" && invitation.organizationId) {
        await readPayload(await fetcher(`${organizationsRoot}/${encodeURIComponent(invitation.organizationId)}/invitations/${encodeURIComponent(invitation.id)}`, { method: "DELETE" }));
        return;
      }
      parseAdminInvitationDeleteResponse(
        await readPayload(await fetcher(`${root}/invitations/${invitation.id}`, { method: "DELETE" })),
      );
    },
    async changeRoles(input) {
      return parseAdminRoleChangeResponse(
        await readPayload(await fetcher(`${root}/roles`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        })),
      );
    },
  };
}
