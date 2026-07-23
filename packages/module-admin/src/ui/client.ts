import type { AdminUiClient } from "./types";

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? response.statusText);
  return payload as T;
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
      return readJson(await fetcher(`${root}?${query.toString()}`));
    },
    async listInvitations() {
      const payload = await readJson<{ data?: Awaited<ReturnType<AdminUiClient["listInvitations"]>> }>(
        await fetcher(`${root}/invitations`),
      );
      return payload.data ?? [];
    },
    async inviteUser(input) {
      const payload = await readJson<{ data: Awaited<ReturnType<AdminUiClient["inviteUser"]>> }>(
        await fetcher(`${root}/invitations`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        }),
      );
      return payload.data;
    },
    async revokeInvitation(invitationId) {
      await readJson(await fetcher(`${root}/invitations/${invitationId}`, { method: "DELETE" }));
    },
    async changeRoles(input) {
      const payload = await readJson<{ summary?: { changed?: number; skipped?: number } }>(
        await fetcher(`${root}/roles`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        }),
      );
      return {
        changed: Number(payload.summary?.changed ?? 0),
        skipped: Number(payload.summary?.skipped ?? 0),
      };
    },
  };
}
