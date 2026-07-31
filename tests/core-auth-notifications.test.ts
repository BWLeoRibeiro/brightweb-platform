import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createNotificationsGetHandler,
  createNotificationsPostHandler,
  resolveNotificationSeenAt,
} from "../packages/core-auth/src/notifications/http.ts";

test("notification migrations keep recent items after acknowledgement and preserve audience boundaries", () => {
  const coreMigration = readFileSync(
    new URL(
      "../packages/create-bw-app/template/supabase/modules/core/migrations/20260731120000_core_notifications.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(coreMigration, /user_role_assignments/);

  const realtimeMigration = readFileSync(
    new URL(
      "../packages/create-bw-app/template/supabase/modules/core/migrations/20260731122000_core_realtime_activity.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const realtimeItemsFunction = realtimeMigration.match(
    /CREATE OR REPLACE FUNCTION public\.current_notification_items[\s\S]+?REVOKE ALL ON FUNCTION public\.current_notification_items/,
  )?.[0];
  assert.ok(realtimeItemsFunction);
  assert.doesNotMatch(realtimeItemsFunction, /alerts_seen_at/);
  assert.match(
    realtimeMigration,
    /DROP FUNCTION IF EXISTS public\.current_notification_items\(uuid, integer\);[\s\S]+CREATE OR REPLACE FUNCTION public\.current_notification_items/,
  );

  const adminMigration = readFileSync(
    new URL(
      "../packages/create-bw-app/template/supabase/modules/admin/migrations/20260731122500_admin_activity_visibility.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(adminMigration, /IF p_domain = 'admin' THEN\s+RETURN v_role = 'admin'/);

  const projectsMigration = readFileSync(
    new URL(
      "../packages/create-bw-app/template/supabase/modules/projects/migrations/20260731123000_project_realtime_visibility.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(projectsMigration, /IF v_role = 'admin' THEN\s+RETURN true/);
  assert.doesNotMatch(
    projectsMigration,
    /IF v_role = ANY \(ARRAY\['staff', 'admin'\]\) THEN\s+RETURN true/,
  );
  assert.match(projectsMigration, /member\.role = 'admin'/);
  assert.match(projectsMigration, /capture_removed_project_member_realtime_audience/);
});

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
            event_type: "crm_contact_created",
            actor_profile_id: "profile-2",
            summary: "Contacto criado",
            payload: { contact_name: "Ada Lovelace" },
          }],
          error: null,
        }),
      };
    },
    from(table: string) {
      assert.equal(table, "profiles");
      return {
        select() { return this; },
        in(_column: string, ids: string[]) {
          assert.deepEqual(ids, ["profile-2"]);
          return {
            overrideTypes: async () => ({
              data: [{ id: "profile-2", first_name: "Grace", last_name: "Hopper" }],
              error: null,
            }),
          };
        },
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
      eventType: "crm_contact_created",
      actorProfileId: "profile-2",
      actorLabel: "Grace Hopper",
      summary: "Contacto criado",
      payload: { contact_name: "Ada Lovelace" },
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
