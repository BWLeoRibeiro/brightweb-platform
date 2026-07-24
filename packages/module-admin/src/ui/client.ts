import type { AdminUiClient } from "./types";
import { readPublicError } from "@brightweblabs/infra/robustness";
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

export function createAdminUiClient(basePath = "/api/admin/users", fetcher: typeof fetch = fetch): AdminUiClient {
  const root = basePath.replace(/\/$/, "");

  return {
    async listUsers(params) {
      const query = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize),
      });
      if (params.search) query.set("search", params.search);
      if (params.role) query.set("role", params.role);
      return parseAdminUsersResponse(await readPayload(await fetcher(`${root}?${query.toString()}`)));
    },
    async listInvitations() {
      return parseAdminInvitationsResponse(await readPayload(await fetcher(`${root}/invitations`)));
    },
    async inviteUser(input) {
      return parseAdminInvitationWriteResponse(
        await readPayload(await fetcher(`${root}/invitations`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        })),
      );
    },
    async revokeInvitation(invitationId) {
      parseAdminInvitationDeleteResponse(
        await readPayload(await fetcher(`${root}/invitations/${invitationId}`, { method: "DELETE" })),
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
