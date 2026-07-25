import assert from "node:assert/strict";
import test from "node:test";
import {
  isEmailable,
  setSubscription,
  unsubscribeAll,
} from "../packages/module-marketing/src/server.ts";

type QueryResult = { data: unknown; error: null };

function terminal(result: QueryResult) {
  return {
    then(resolve: (value: QueryResult) => unknown) {
      return Promise.resolve(resolve(result));
    },
    single: async () => result,
    maybeSingle: async () => result,
  };
}

test("setSubscription captures consent and clears unsubscribe time when subscribing", async () => {
  let upserted: Record<string, unknown> | null = null;
  const supabase = {
    from(table: string) {
      assert.equal(table, "marketing_subscriptions");
      return {
        upsert(payload: Record<string, unknown>, options: unknown) {
          upserted = payload;
          assert.deepEqual(options, { onConflict: "contact_id,topic_id" });
          return {
            select() {
              return terminal({
                data: {
                  id: "subscription-1",
                  ...payload,
                  created_at: "2026-01-01T00:00:00.000Z",
                  updated_at: "2026-01-01T00:00:00.000Z",
                },
                error: null,
              });
            },
          };
        },
      };
    },
  };

  const result = await setSubscription(supabase, {
    contactId: "contact-1",
    topicId: "topic-1",
    status: "subscribed",
    consentSource: "form",
  });

  assert.equal(upserted?.status, "subscribed");
  assert.equal(typeof upserted?.consent_at, "string");
  assert.equal(upserted?.unsubscribed_at, null);
  assert.equal(result.consentSource, "form");
});

test("isEmailable requires a subscription, an email, and no suppression", async () => {
  function client(suppressed: boolean) {
    return {
      from(table: string) {
        const state = { filters: [] as Array<[string, unknown]> };
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                state.filters.push([column, value]);
                return this;
              },
              async maybeSingle() {
                if (table === "marketing_subscriptions") {
                  return { data: { status: "subscribed" }, error: null };
                }
                if (table === "crm_contacts") {
                  return { data: { email: "Person@Example.COM " }, error: null };
                }
                assert.equal(table, "marketing_suppressions");
                assert.deepEqual(state.filters, [["email", "person@example.com"]]);
                return { data: suppressed ? { id: "suppression-1" } : null, error: null };
              },
            };
          },
        };
      },
    };
  }

  assert.equal(await isEmailable(client(false), "contact-1", "topic-1"), true);
  assert.equal(await isEmailable(client(true), "contact-1", "topic-1"), false);
});

test("unsubscribeAll resolves the token, flips subscriptions, and suppresses the email", async () => {
  const updates: Record<string, unknown>[] = [];
  const suppressions: Record<string, unknown>[] = [];
  const topics = [{
    id: "topic-1",
    slug: "newsletter",
    label: "Newsletter",
    description: null,
    is_active: true,
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }];
  let subscriptionStatus = "subscribed";

  const supabase = {
    from(table: string) {
      if (table === "marketing_topics") {
        return {
          select() {
            return {
              order() {
                return this;
              },
              then(resolve: (value: QueryResult) => unknown) {
                return Promise.resolve(resolve({ data: topics, error: null }));
              },
            };
          },
        };
      }
      if (table === "marketing_contact_settings") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              maybeSingle: async () => ({ data: { contact_id: "contact-1" }, error: null }),
            };
          },
        };
      }
      if (table === "crm_contacts") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              maybeSingle: async () => ({
                data: {
                  id: "contact-1",
                  first_name: "Ada",
                  last_name: "Lovelace",
                  email: "ADA@EXAMPLE.COM",
                },
                error: null,
              }),
            };
          },
        };
      }
      if (table === "marketing_subscriptions") {
        return {
          select() {
            return {
              eq() {
                return Promise.resolve({
                  data: [{
                    id: "subscription-1",
                    contact_id: "contact-1",
                    topic_id: "topic-1",
                    status: subscriptionStatus,
                    consent_source: "form",
                    consent_at: "2026-01-01T00:00:00.000Z",
                    unsubscribed_at: null,
                    created_at: "2026-01-01T00:00:00.000Z",
                    updated_at: "2026-01-01T00:00:00.000Z",
                  }],
                  error: null,
                });
              },
            };
          },
          update(payload: Record<string, unknown>) {
            updates.push(payload);
            subscriptionStatus = "unsubscribed";
            return {
              eq: async () => ({ data: null, error: null }),
            };
          },
        };
      }
      assert.equal(table, "marketing_suppressions");
      return {
        upsert(payload: Record<string, unknown>) {
          suppressions.push(payload);
          return {
            select() {
              return terminal({
                data: { id: "suppression-1", ...payload, created_at: "now" },
                error: null,
              });
            },
          };
        },
      };
    },
  };

  const result = await unsubscribeAll(
    supabase,
    "11111111-1111-4111-8111-111111111111",
  );
  assert.equal(result?.subscriptions[0]?.status, "unsubscribed");
  assert.equal(updates[0]?.status, "unsubscribed");
  assert.deepEqual(suppressions[0], {
    email: "ada@example.com",
    reason: "unsubscribed_all",
    source: "unsubscribe-token",
  });
});
