import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  subscribeToAppActivityEvents,
  type AppActivityRealtimePayload,
} from "../packages/infra/src/realtime.ts";

test("activity realtime subscribes every requested domain with auth and cleans up", async () => {
  const channelNames: string[] = [];
  const filters: string[] = [];
  const removed: unknown[] = [];
  const statuses: string[] = [];
  const inserts: AppActivityRealtimePayload[] = [];
  const callbacks: Array<(payload: AppActivityRealtimePayload) => void> = [];
  let realtimeToken = "";

  const fakeClient = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "session-token" } },
        error: null,
      }),
    },
    realtime: {
      setAuth: async (token: string) => {
        realtimeToken = token;
      },
    },
    channel: (name: string) => {
      const channel = {
        on: (
          _kind: string,
          config: { filter?: string },
          callback: (payload: AppActivityRealtimePayload) => void
        ) => {
          if (config.filter) filters.push(config.filter);
          callbacks.push(callback);
          return channel;
        },
        subscribe: (callback: (status: string) => void) => {
          callback("SUBSCRIBED");
          return channel;
        },
      };
      channelNames.push(name);
      return channel;
    },
    removeChannel: async (channel: unknown) => {
      removed.push(channel);
    },
  } as unknown as SupabaseClient;

  const unsubscribe = subscribeToAppActivityEvents({
    channelName: "test:activity",
    domains: ["crm", "projects", "crm"],
    onInsert: (payload) => inserts.push(payload),
    onStatus: (status) => statuses.push(status),
    supabase: fakeClient,
  });

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(realtimeToken, "session-token");
  assert.deepEqual(channelNames, [
    "test:activity:crm",
    "test:activity:projects",
  ]);
  assert.deepEqual(filters, ["domain=eq.crm", "domain=eq.projects"]);
  assert.deepEqual(statuses, ["SUBSCRIBED", "SUBSCRIBED"]);

  const payload = {
    commit_timestamp: "2026-07-31T12:00:00.000Z",
    errors: null,
    eventType: "INSERT",
    new: {
      id: "event-1",
      created_at: "2026-07-31T12:00:00.000Z",
      domain: "crm",
      event_type: "crm_contact_updated",
      entity_table: "crm_contacts",
      entity_id: "contact-1",
      actor_profile_id: "profile-1",
      summary: "Contact updated",
      payload: {},
    },
    old: {},
    schema: "public",
    table: "app_activity_events",
  } satisfies AppActivityRealtimePayload;
  callbacks[0]?.(payload);
  assert.deepEqual(inserts, [payload]);

  callbacks[1]?.(payload);
  assert.deepEqual(inserts, [payload]);

  unsubscribe();
  assert.equal(removed.length, 2);
});

test("activity realtime does not open channels after an early unsubscribe", async () => {
  let resolveSession!: (value: {
    data: { session: { access_token: string } };
    error: null;
  }) => void;
  let openedChannels = 0;
  const fakeClient = {
    auth: {
      getSession: () => new Promise((resolve) => {
        resolveSession = resolve;
      }),
    },
    realtime: { setAuth: async () => undefined },
    channel: () => {
      openedChannels += 1;
      return {};
    },
    removeChannel: async () => undefined,
  } as unknown as SupabaseClient;

  const unsubscribe = subscribeToAppActivityEvents({
    onInsert: () => undefined,
    supabase: fakeClient,
  });
  unsubscribe();
  resolveSession({
    data: { session: { access_token: "session-token" } },
    error: null,
  });

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(openedChannels, 0);
});

test("activity realtime reports a missing session without opening channels", async () => {
  let openedChannels = 0;
  const statuses: string[] = [];
  const authStates: string[] = [];
  const fakeClient = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    realtime: { setAuth: async () => undefined },
    channel: () => {
      openedChannels += 1;
      return {};
    },
    removeChannel: async () => undefined,
  } as unknown as SupabaseClient;

  subscribeToAppActivityEvents({
    onInsert: () => undefined,
    onAuth: (state) => authStates.push(state),
    onStatus: (status) => statuses.push(status),
    supabase: fakeClient,
  });

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(openedChannels, 0);
  assert.deepEqual(authStates, ["NO_SESSION"]);
  assert.deepEqual(statuses, ["NO_SESSION"]);
});
