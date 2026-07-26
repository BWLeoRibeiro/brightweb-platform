import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { expandCampaignRecipients } from "../packages/module-marketing/src/campaigns";
import { previewSegment } from "../packages/module-marketing/src/segments";
import type {
  MarketingEmailMessage,
  MarketingEmailSender,
} from "../packages/module-marketing/src/email/types";
import { runMarketingWorker } from "../packages/module-marketing/src/worker";
import { processResendWebhook } from "../packages/module-marketing/src/webhooks";

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

function valueMatches(row: Row, filter: [string, string, unknown]) {
  const [operator, key, expected] = filter;
  if (operator === "eq") return row[key] === expected;
  if (operator === "in") return (expected as unknown[]).includes(row[key]);
  if (operator === "lte") return row[key] != null && row[key] <= expected;
  if (operator === "gte") return row[key] != null && row[key] >= expected;
  if (operator === "not-null") return row[key] != null;
  return true;
}

class FakeQuery implements PromiseLike<any> {
  private readonly tables: Tables;
  private readonly table: string;
  private operation: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private filters: Array<[string, string, unknown]> = [];
  private payload: Row | Row[] | null = null;
  private wantsSingle = false;
  private wantsMaybeSingle = false;
  private countMode = false;
  private head = false;
  private limitValue: number | null = null;
  private ignoreDuplicates = false;

  constructor(tables: Tables, table: string) {
    this.tables = tables;
    this.table = table;
  }

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (this.operation === "select") this.operation = "select";
    this.countMode = options?.count === "exact";
    this.head = options?.head === true;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload: Row | Row[], options?: { ignoreDuplicates?: boolean }) {
    this.operation = "upsert";
    this.payload = payload;
    this.ignoreDuplicates = options?.ignoreDuplicates === true;
    return this;
  }

  update(payload: Row) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push(["eq", key, value]);
    return this;
  }

  in(key: string, value: unknown[]) {
    this.filters.push(["in", key, value]);
    return this;
  }

  lte(key: string, value: unknown) {
    this.filters.push(["lte", key, value]);
    return this;
  }

  gte(key: string, value: unknown) {
    this.filters.push(["gte", key, value]);
    return this;
  }

  not(key: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) {
      this.filters.push(["not-null", key, value]);
    }
    return this;
  }

  order() {
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  single() {
    this.wantsSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantsMaybeSingle = true;
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private matchingRows() {
    return (this.tables[this.table] ?? []).filter((row) =>
      this.filters.every((filter) => valueMatches(row, filter))
    );
  }

  private execute() {
    const table = this.tables[this.table] ?? (this.tables[this.table] = []);
    if (this.operation === "select") {
      const rows = this.matchingRows().slice(
        0,
        this.limitValue ?? Number.POSITIVE_INFINITY,
      );
      if (this.countMode) {
        return { data: this.head ? null : rows, count: rows.length, error: null };
      }
      if (this.wantsSingle || this.wantsMaybeSingle) {
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    }

    const payloads = (Array.isArray(this.payload) ? this.payload : [this.payload])
      .filter((row): row is Row => Boolean(row))
      .map((row) => ({ ...row }));
    if (this.operation === "insert" || this.operation === "upsert") {
      const inserted: Row[] = [];
      for (const payload of payloads) {
        const duplicate = this.table === "marketing_campaign_recipients"
          ? table.find((row) =>
            row.campaign_id === payload.campaign_id
            && row.contact_id === payload.contact_id
          )
          : this.table === "marketing_message_events"
            ? table.find((row) =>
              row.provider === payload.provider
              && row.provider_event_id
              && row.provider_event_id === payload.provider_event_id
            )
            : this.table === "marketing_suppressions"
              ? table.find((row) => row.email === payload.email)
              : null;
        if (duplicate && this.table === "marketing_message_events") {
          return { data: null, error: { code: "23505", message: "duplicate" } };
        }
        if (duplicate && this.ignoreDuplicates) continue;
        if (duplicate) {
          Object.assign(duplicate, payload);
          inserted.push(duplicate);
        } else {
          const row = {
            id: payload.id ?? `${this.table}-${table.length + 1}`,
            created_at: payload.created_at ?? "2026-07-25T12:00:00.000Z",
            updated_at: payload.updated_at ?? "2026-07-25T12:00:00.000Z",
            ...payload,
          };
          table.push(row);
          inserted.push(row);
        }
      }
      return {
        data: this.wantsSingle ? inserted[0] ?? null : inserted,
        error: null,
      };
    }

    const matches = this.matchingRows();
    if (this.operation === "update") {
      for (const row of matches) Object.assign(row, this.payload);
      return {
        data: this.wantsSingle ? matches[0] ?? null : matches,
        error: null,
      };
    }
    this.tables[this.table] = table.filter((row) => !matches.includes(row));
    return { data: null, error: null };
  }
}

function fakeSupabase(tables: Tables) {
  return {
    from(table: string) {
      return new FakeQuery(tables, table);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "claim_marketing_campaign_recipients");
      const campaignId = args.target_campaign_id;
      const limit = Number(args.claim_limit);
      const claimTime = String(args.claim_time);
      const claimed = tables.marketing_campaign_recipients
        .filter((row) =>
          row.campaign_id === campaignId
          && row.status === "queued"
          && (!row.next_attempt_at || row.next_attempt_at <= claimTime)
        )
        .slice(0, limit);
      for (const row of claimed) {
        row.status = "sending";
        row.attempt_count += 1;
      }
      return { data: claimed.map((row) => ({ ...row })), error: null };
    },
  };
}

function campaign(overrides: Row = {}) {
  return {
    id: "campaign-1",
    name: "Launch",
    subject: "Hello",
    preheader: null,
    from_name: "BrightWeb",
    from_email: "hello@example.com",
    topic_id: "topic-1",
    segment_id: null,
    body_html: "<p>Hello</p>",
    body_text: "Hello",
    body_json: null,
    status: "draft",
    scheduled_at: null,
    sent_at: null,
    batch_size: 100,
    rate_per_minute: null,
    total_recipients: 0,
    sent_count: 0,
    failed_count: 0,
    created_by_profile_id: null,
    created_at: "2026-07-25T12:00:00.000Z",
    updated_at: "2026-07-25T12:00:00.000Z",
    ...overrides,
  };
}

test("campaign expansion queues only topic opt-ins and records suppressions", async () => {
  const tables: Tables = {
    marketing_campaigns: [campaign()],
    marketing_subscriptions: [
      { contact_id: "contact-1", topic_id: "topic-1", status: "subscribed" },
      { contact_id: "contact-2", topic_id: "topic-1", status: "subscribed" },
      { contact_id: "contact-3", topic_id: "topic-1", status: "unsubscribed" },
      { contact_id: "contact-4", topic_id: "topic-other", status: "subscribed" },
    ],
    crm_contacts: [
      { id: "contact-1", email: "YES@Example.com" },
      { id: "contact-2", email: "blocked@example.com" },
      { id: "contact-3", email: "no@example.com" },
      { id: "contact-4", email: "other@example.com" },
    ],
    marketing_suppressions: [{ email: "blocked@example.com" }],
    marketing_campaign_recipients: [],
  };

  const result = await expandCampaignRecipients(fakeSupabase(tables), "campaign-1");

  assert.deepEqual(result, { total: 2, queued: 1, suppressed: 1 });
  assert.deepEqual(
    tables.marketing_campaign_recipients.map(({ email, status }) => ({ email, status })),
    [
      { email: "yes@example.com", status: "queued" },
      { email: "blocked@example.com", status: "suppressed" },
    ],
  );
  assert.equal(tables.marketing_campaigns[0]?.total_recipients, 2);
});

test("segment preview combines topic, engagement, and suppression filters", async () => {
  const now = new Date().toISOString();
  const tables: Tables = {
    crm_contacts: [
      {
        id: "contact-1",
        email: "one@example.com",
        first_name: "Ana",
        last_name: "Silva",
        preferred_language: "pt-PT",
        created_at: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "contact-2",
        email: "two@example.com",
        first_name: "Bruno",
        last_name: "Costa",
        preferred_language: "pt-PT",
        created_at: "2026-07-02T00:00:00.000Z",
      },
      {
        id: "contact-3",
        email: "three@example.com",
        first_name: "Carla",
        last_name: "Luz",
        preferred_language: "pt-PT",
        created_at: "2026-07-03T00:00:00.000Z",
      },
    ],
    marketing_subscriptions: [
      { contact_id: "contact-1", topic_id: "topic-1", status: "subscribed" },
      { contact_id: "contact-2", topic_id: "topic-1", status: "subscribed" },
      { contact_id: "contact-3", topic_id: "topic-2", status: "subscribed" },
    ],
    marketing_message_events: [
      { contact_id: "contact-1", event_type: "clicked", occurred_at: now },
      { contact_id: "contact-2", event_type: "clicked", occurred_at: now },
      { contact_id: "contact-3", event_type: "opened", occurred_at: now },
    ],
    marketing_suppressions: [{ email: "two@example.com" }],
    marketing_contact_settings: [],
  };

  const result = await previewSegment(
    fakeSupabase(tables),
    {
      topicIds: ["topic-1"],
      engagedWithinDays: 30,
      engagementType: "clicked",
      excludeSuppressed: true,
    },
    { limit: 5 },
  );

  assert.equal(result.count, 1);
  assert.deepEqual(result.sample, [{
    id: "contact-1",
    email: "one@example.com",
    name: "Ana Silva",
  }]);
});

test("campaign segment intersects topic consent and never widens recipients", async () => {
  const tables: Tables = {
    marketing_campaigns: [campaign({ segment_id: "segment-1" })],
    marketing_segments: [{
      id: "segment-1",
      name: "Português",
      description: null,
      rule_json: { preferredLanguage: "pt-PT" },
      created_by_profile_id: null,
      created_at: "2026-07-25T12:00:00.000Z",
      updated_at: "2026-07-25T12:00:00.000Z",
    }],
    marketing_subscriptions: [
      { contact_id: "contact-1", topic_id: "topic-1", status: "subscribed" },
      { contact_id: "contact-2", topic_id: "topic-1", status: "subscribed" },
    ],
    crm_contacts: [
      {
        id: "contact-1",
        email: "consented@example.com",
        preferred_language: "pt-PT",
        created_at: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "contact-2",
        email: "english@example.com",
        preferred_language: "en",
        created_at: "2026-07-02T00:00:00.000Z",
      },
      {
        id: "contact-3",
        email: "no-consent@example.com",
        preferred_language: "pt-PT",
        created_at: "2026-07-03T00:00:00.000Z",
      },
    ],
    marketing_suppressions: [],
    marketing_contact_settings: [
      { contact_id: "contact-1", preferred_language: "pt-PT" },
      { contact_id: "contact-2", preferred_language: "en" },
      { contact_id: "contact-3", preferred_language: "pt-PT" },
    ],
    marketing_campaign_recipients: [],
  };

  const result = await expandCampaignRecipients(fakeSupabase(tables), "campaign-1");

  assert.deepEqual(result, { total: 1, queued: 1, suppressed: 0 });
  assert.deepEqual(
    tables.marketing_campaign_recipients.map((row) => row.contact_id),
    ["contact-1"],
  );
});

test("worker claims once and records fake sender sent/failed outcomes", async () => {
  const tables: Tables = {
    marketing_campaigns: [campaign({ status: "sending", total_recipients: 2 })],
    marketing_campaign_recipients: [
      {
        id: "recipient-1",
        campaign_id: "campaign-1",
        contact_id: "contact-1",
        email: "one@example.com",
        status: "queued",
        attempt_count: 0,
        next_attempt_at: null,
      },
      {
        id: "recipient-2",
        campaign_id: "campaign-1",
        contact_id: "contact-2",
        email: "two@example.com",
        status: "queued",
        attempt_count: 0,
        next_attempt_at: null,
      },
    ],
    marketing_contact_settings: [
      { contact_id: "contact-1", unsubscribe_token: "token-1" },
      { contact_id: "contact-2", unsubscribe_token: "token-2" },
    ],
  };
  const sentMessages: MarketingEmailMessage[] = [];
  const sender: MarketingEmailSender = {
    async sendOne() {
      throw new Error("not used");
    },
    async sendBatch(messages) {
      sentMessages.push(...messages);
      return [
        { ok: true, providerMessageId: "provider-1" },
        { ok: false, error: "provider rejected" },
      ];
    },
  };

  const result = await runMarketingWorker({
    supabase: fakeSupabase(tables),
    sender,
    publicAppUrl: "https://app.example.com",
    now: () => new Date("2026-07-25T13:00:00.000Z"),
  });

  assert.deepEqual(
    {
      claimed: result.claimed,
      sent: result.sent,
      failed: result.failed,
    },
    { claimed: 2, sent: 1, failed: 1 },
  );
  assert.equal(sentMessages.length, 2);
  assert.match(
    sentMessages[0]?.headers?.["List-Unsubscribe"] ?? "",
    /token-1/,
  );
  assert.equal(tables.marketing_campaign_recipients[0]?.status, "sent");
  assert.equal(
    tables.marketing_campaign_recipients[0]?.provider_message_id,
    "provider-1",
  );
  assert.equal(tables.marketing_campaign_recipients[1]?.status, "failed");
  assert.equal(tables.marketing_campaign_recipients[1]?.attempt_count, 1);
  assert.equal(tables.marketing_campaigns[0]?.status, "sent");
  assert.equal(tables.marketing_campaigns[0]?.sent_count, 1);
  assert.equal(tables.marketing_campaigns[0]?.failed_count, 1);
});

function signedWebhook(body: string, secret: string) {
  const id = "msg_webhook_1";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const signature = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return new Headers({
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signature}`,
  });
}

test("verified bounce webhook deduplicates and suppresses the contact", async () => {
  const tables: Tables = {
    marketing_campaign_recipients: [{
      id: "recipient-1",
      campaign_id: "campaign-1",
      contact_id: "contact-1",
      email: "bounce@example.com",
      provider_message_id: "provider-1",
      status: "sent",
    }],
    marketing_message_events: [],
    marketing_suppressions: [],
    marketing_subscriptions: [{
      contact_id: "contact-1",
      topic_id: "topic-1",
      status: "subscribed",
    }],
  };
  const secret = `whsec_${Buffer.from("campaign-test-secret-32-bytes!!").toString("base64")}`;
  const body = JSON.stringify({
    type: "email.bounced",
    created_at: "2026-07-25T13:00:00.000Z",
    data: { email_id: "provider-1", to: ["bounce@example.com"] },
  });
  const headers = signedWebhook(body, secret);
  const supabase = fakeSupabase(tables);

  const first = await processResendWebhook(supabase, body, headers, secret);
  const second = await processResendWebhook(supabase, body, headers, secret);

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(tables.marketing_message_events.length, 1);
  assert.equal(tables.marketing_campaign_recipients[0]?.status, "suppressed");
  assert.equal(tables.marketing_suppressions[0]?.email, "bounce@example.com");
  assert.equal(tables.marketing_suppressions[0]?.reason, "bounced");
  assert.equal(tables.marketing_subscriptions[0]?.status, "unsubscribed");
});
