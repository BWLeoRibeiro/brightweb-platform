import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createNotificationsGetHandler,
  createNotificationsPostHandler,
  resolveNotificationSeenAt,
} from "../packages/core-auth/src/notifications/http.ts";

test("notification seen timestamps preserve click time and clamp future values", () => {
  const receivedAt = new Date("2026-07-31T12:00:00.000Z");
  assert.equal(
    resolveNotificationSeenAt("2026-07-31T11:59:58.000Z", receivedAt),
    "2026-07-31T11:59:58.000Z",
  );
  assert.equal(
    resolveNotificationSeenAt("2026-07-31T12:30:00.000Z", receivedAt),
    "2026-07-31T12:00:00.000Z",
  );
});

test("notification GET loads summary and unread items in parallel", async () => {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const client = {
    rpc(name: string, params: Record<string, unknown>) {
      calls.push([name, params]);
      if (name === "current_notification_summary") {
        return {
          maybeSingle: async () => ({
            data: { seen_at: "2026-07-31T10:00:00.000Z", unread_count: "2" },
            error: null,
          }),
        };
      }
      return {
        overrideTypes: async () => ({
          data: [{
            id: "event-1",
            created_at: "2026-07-31T11:00:00.000Z",
            domain: "crm",
            summary: "Contacto criado",
          }],
          error: null,
        }),
      };
    },
  } as unknown as SupabaseClient;
  const GET = createNotificationsGetHandler({
    getAccess: async () => ({ ok: true, profileId: "profile-1" }),
    getServiceClient: () => client,
  });

  const response = await GET(new Request("https://portal.test/api/notifications?limit=8"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [{
      id: "event-1",
      createdAt: "2026-07-31T11:00:00.000Z",
      domain: "crm",
      summary: "Contacto criado",
    }],
    unreadCount: 2,
    seenAt: "2026-07-31T10:00:00.000Z",
  });
  assert.deepEqual(calls, [
    ["current_notification_summary", { p_profile_id: "profile-1" }],
    ["current_notification_items", { p_profile_id: "profile-1", p_limit: 8 }],
  ]);
});

test("notification POST acknowledges only the authenticated profile", async () => {
  let upserted: Record<string, unknown> | null = null;
  const client = {
    from(table: string) {
      assert.equal(table, "user_notification_state");
      return {
        upsert: async (values: Record<string, unknown>, options: { onConflict: string }) => {
          upserted = values;
          assert.equal(options.onConflict, "profile_id");
          return { data: null, error: null };
        },
      };
    },
  } as unknown as SupabaseClient;
  const POST = createNotificationsPostHandler({
    getAccess: async () => ({ ok: true, profileId: "profile-1" }),
    getServiceClient: () => client,
    now: () => new Date("2026-07-31T12:00:00.000Z"),
  });

  const response = await POST(new Request("https://portal.test/api/notifications", {
    method: "POST",
    body: JSON.stringify({ seenBefore: "2026-07-31T11:59:58.000Z" }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(upserted, {
    profile_id: "profile-1",
    alerts_seen_at: "2026-07-31T11:59:58.000Z",
  });
});
