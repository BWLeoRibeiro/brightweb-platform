import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  expandCampaignRecipients,
  sendTestEmail,
} from "../packages/module-marketing/src/campaigns";
import { previewSegment } from "../packages/module-marketing/src/segments";
import type {
  MarketingEmailMessage,
  MarketingEmailSender,
} from "../packages/module-marketing/src/email/types";
import { runMarketingWorker } from "../packages/module-marketing/src/worker";
import { processResendWebhook } from "../packages/module-marketing/src/webhooks";
import { unsubscribeTopic } from "../packages/module-marketing/src/server";
import {
  enqueueWorkflowRunsForTrigger,
  processDueWorkflowRuns,
  scanActivityTriggers,
} from "../packages/module-marketing/src/workflows";

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

function valueMatches(row: Row, filter: [string, string, unknown]) {
  const [operator, key, expected] = filter;
  if (operator === "eq") return row[key] === expected;
  if (operator === "in") return (expected as unknown[]).includes(row[key]);
  if (operator === "lte") return row[key] != null && row[key] <= expected;
  if (operator === "gte") return row[key] != null && row[key] >= expected;
  if (operator === "gt") return row[key] != null && row[key] > expected;
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
  private orders: Array<{ key: string; ascending: boolean }> = [];

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

  gt(key: string, value: unknown) {
    this.filters.push(["gt", key, value]);
    return this;
  }

  not(key: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) {
      this.filters.push(["not-null", key, value]);
    }
    return this;
  }

  order(key: string, options?: { ascending?: boolean }) {
    this.orders.push({ key, ascending: options?.ascending !== false });
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
    const rows = (this.tables[this.table] ?? []).filter((row) =>
      this.filters.every((filter) => valueMatches(row, filter))
    );
    return rows.toSorted((left, right) => {
      for (const order of this.orders) {
        const comparison = String(left[order.key] ?? "")
          .localeCompare(String(right[order.key] ?? ""));
        if (comparison) return order.ascending ? comparison : -comparison;
      }
      return 0;
    });
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
            : this.table === "marketing_workflow_runs"
              ? table.find((row) =>
                row.workflow_id === payload.workflow_id
                && row.contact_id === payload.contact_id
              )
              : this.table === "marketing_contact_tags"
                ? table.find((row) =>
                  row.contact_id === payload.contact_id && row.tag === payload.tag
                )
                : this.table === "marketing_worker_cursors"
                  ? table.find((row) => row.key === payload.key)
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

function fakeSupabase(tables: Tables, options: { failWebhookAfterEventOnce?: boolean } = {}) {
  let failWebhookAfterEvent = options.failWebhookAfterEventOnce === true;
  return {
    from(table: string) {
      return new FakeQuery(tables, table);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "process_marketing_resend_webhook") {
        const snapshot = structuredClone(tables);
        const recipient = (tables.marketing_campaign_recipients ?? []).find(
          (row) => row.provider_message_id === args.p_provider_message_id,
        ) ?? null;
        const existing = (tables.marketing_message_events ?? []).find(
          (row) => row.provider === "resend" && row.provider_event_id === args.p_provider_event_id,
        );
        if (existing) {
          return {
            data: [{ duplicate: true, event_type: args.p_event_type, recipient_id: recipient?.id ?? null }],
            error: null,
          };
        }

        (tables.marketing_message_events ??= []).push({
          id: `event-${tables.marketing_message_events.length + 1}`,
          campaign_id: recipient?.campaign_id ?? null,
          recipient_id: recipient?.id ?? null,
          contact_id: recipient?.contact_id ?? null,
          provider: "resend",
          event_type: args.p_event_type,
          provider_event_id: args.p_provider_event_id,
          payload: args.p_payload,
          occurred_at: args.p_occurred_at,
        });
        if (failWebhookAfterEvent) {
          failWebhookAfterEvent = false;
          for (const key of new Set([...Object.keys(tables), ...Object.keys(snapshot)])) {
            if (snapshot[key]) tables[key] = snapshot[key];
            else delete tables[key];
          }
          return { data: null, error: { message: "injected derived mutation failure" } };
        }

        const eventType = String(args.p_event_type);
        if (recipient && ["delivered", "sent"].includes(eventType)) {
          Object.assign(recipient, { status: "sent", sent_at: args.p_occurred_at, error: null });
        } else if (recipient && eventType === "failed") {
          Object.assign(recipient, { status: "failed", error: "Resend reported delivery failure." });
        } else if (recipient && ["bounced", "complained", "unsubscribed"].includes(eventType)) {
          const reason = eventType === "bounced" ? "bounced" : eventType === "complained" ? "complained" : "unsubscribed_all";
          Object.assign(recipient, { status: "suppressed", error: `Resend reported ${eventType}.`, next_attempt_at: null });
          const normalizedEmail = String(recipient.email).trim().toLowerCase();
          const suppression = (tables.marketing_suppressions ??= []).find((row) => row.email === normalizedEmail);
          if (suppression) Object.assign(suppression, { reason, source: "resend_webhook" });
          else tables.marketing_suppressions.push({ id: `suppression-${tables.marketing_suppressions.length + 1}`, email: normalizedEmail, reason, source: "resend_webhook" });
          for (const queued of tables.marketing_campaign_recipients ?? []) {
            if (String(queued.email).trim().toLowerCase() === normalizedEmail && ["queued", "sending"].includes(queued.status)) {
              Object.assign(queued, { status: "suppressed", error: `Email suppressed: ${reason}.`, next_attempt_at: null });
            }
          }
          for (const subscription of tables.marketing_subscriptions ?? []) {
            if (subscription.contact_id === recipient.contact_id) {
              Object.assign(subscription, { status: "unsubscribed", unsubscribed_at: args.p_occurred_at });
            }
          }
        }
        return {
          data: [{ duplicate: false, event_type: eventType, recipient_id: recipient?.id ?? null }],
          error: null,
        };
      }
      if (name === "claim_marketing_workflow_runs") {
        const claimTime = String(args.claim_time);
        const claimed = (tables.marketing_workflow_runs ?? [])
          .filter((row) =>
            row.status === "active"
            && row.next_run_at
            && row.next_run_at <= claimTime
          )
          .slice(0, Number(args.claim_limit));
        for (const row of claimed) {
          row.next_run_at = "2026-07-25T12:05:00.000Z";
        }
        return { data: claimed.map((row) => ({ ...row })), error: null };
      }
      assert.equal(name, "claim_marketing_campaign_recipients");
      const campaignId = args.target_campaign_id;
      const limit = Number(args.claim_limit);
      const claimTime = String(args.claim_time);
      const staleBefore = new Date(
        new Date(claimTime).getTime() - 15 * 60_000,
      ).toISOString();
      const claimed = tables.marketing_campaign_recipients
        .filter((row) =>
          row.campaign_id === campaignId
          && (
            (
              row.status === "queued"
              && (!row.next_attempt_at || row.next_attempt_at <= claimTime)
            )
            || (
              row.status === "failed"
              && row.attempt_count < 3
              && row.next_attempt_at
              && row.next_attempt_at <= claimTime
            )
            || (
              row.status === "sending"
              && row.attempt_count < 3
              && row.updated_at <= staleBefore
            )
          )
        )
        .slice(0, limit);
      for (const row of claimed) {
        row.status = "sending";
        row.attempt_count += 1;
        row.next_attempt_at = null;
        row.updated_at = claimTime;
      }
      return { data: claimed.map((row) => ({ ...row })), error: null };
    },
  };
}

function workflowRun(overrides: Row = {}) {
  return {
    id: `run-${Math.random()}`,
    workflow_id: "workflow-1",
    contact_id: "contact-1",
    status: "active",
    current_position: 0,
    next_run_at: "2026-07-25T11:59:00.000Z",
    context: {},
    started_at: "2026-07-25T11:59:00.000Z",
    completed_at: null,
    created_at: "2026-07-25T11:59:00.000Z",
    updated_at: "2026-07-25T11:59:00.000Z",
    ...overrides,
  };
}

test("workflow enqueue matches trigger config and deduplicates a contact", async () => {
  const tables: Tables = {
    marketing_workflows: [
      {
        id: "matching",
        status: "active",
        trigger_type: "contact_subscribed",
        trigger_config: { topicId: "topic-1" },
      },
      {
        id: "other-topic",
        status: "active",
        trigger_type: "contact_subscribed",
        trigger_config: { topicId: "topic-2" },
      },
      {
        id: "paused",
        status: "paused",
        trigger_type: "contact_subscribed",
        trigger_config: { topicId: "topic-1" },
      },
    ],
    marketing_workflow_runs: [],
  };
  const supabase = fakeSupabase(tables);
  const input = {
    triggerType: "contact_subscribed" as const,
    contactId: "contact-1",
    matchData: { topicId: "topic-1" },
  };

  assert.equal(await enqueueWorkflowRunsForTrigger(supabase, input), 1);
  assert.equal(await enqueueWorkflowRunsForTrigger(supabase, input), 0);
  assert.deepEqual(
    tables.marketing_workflow_runs.map((row) => row.workflow_id),
    ["matching"],
  );
});

test("workflow processor sends, waits, tags, skips suppressed sends, and completes", async () => {
  const tables: Tables = {
    marketing_workflows: [
      { id: "send", status: "active" },
      { id: "wait", status: "active" },
      { id: "tag", status: "active" },
      { id: "suppressed", status: "active" },
    ],
    marketing_workflow_nodes: [
      {
        id: "send-node",
        workflow_id: "send",
        position: 0,
        node_type: "send_email",
        config: {
          subject: "Welcome",
          bodyText: "Hello",
          topicId: "topic-1",
        },
      },
      {
        id: "wait-node",
        workflow_id: "wait",
        position: 0,
        node_type: "wait",
        config: { durationMinutes: 10 },
      },
      {
        id: "wait-tag-node",
        workflow_id: "wait",
        position: 1,
        node_type: "add_tag",
        config: { tag: "after-wait" },
      },
      {
        id: "tag-node",
        workflow_id: "tag",
        position: 0,
        node_type: "add_tag",
        config: { tag: "customer" },
      },
      {
        id: "suppressed-node",
        workflow_id: "suppressed",
        position: 0,
        node_type: "send_email",
        config: {
          subject: "Nope",
          bodyText: "Nope",
          topicId: "topic-1",
        },
      },
    ],
    marketing_workflow_runs: [
      workflowRun({ id: "send-run", workflow_id: "send", contact_id: "contact-1" }),
      workflowRun({ id: "wait-run", workflow_id: "wait", contact_id: "contact-1" }),
      workflowRun({ id: "tag-run", workflow_id: "tag", contact_id: "contact-1" }),
      workflowRun({
        id: "suppressed-run",
        workflow_id: "suppressed",
        contact_id: "contact-2",
      }),
    ],
    crm_contacts: [
      { id: "contact-1", email: "person@example.com" },
      { id: "contact-2", email: "blocked@example.com" },
    ],
    marketing_subscriptions: [
      { contact_id: "contact-1", topic_id: "topic-1", status: "subscribed" },
      { contact_id: "contact-2", topic_id: "topic-1", status: "subscribed" },
    ],
    marketing_suppressions: [{
      id: "suppression",
      email: "blocked@example.com",
    }],
    marketing_contact_tags: [],
    marketing_workflow_step_runs: [],
    marketing_message_events: [],
  };
  const sent: MarketingEmailMessage[] = [];
  const sender: MarketingEmailSender = {
    async sendOne(message) {
      sent.push(message);
      return { ok: true, providerMessageId: "message-1" };
    },
    async sendBatch(messages) {
      sent.push(...messages);
      return messages.map(() => ({
        ok: true as const,
        providerMessageId: "message-1",
      }));
    },
  };

  const result = await processDueWorkflowRuns(
    fakeSupabase(tables),
    { sender, now: () => new Date("2026-07-25T12:00:00.000Z") },
    { limit: 10 },
  );

  assert.deepEqual(result, { claimed: 4, completed: 3, failed: 0 });
  assert.equal(sent.length, 1);
  assert.equal(
    tables.marketing_workflow_runs.find((row) => row.id === "wait-run")
      ?.next_run_at,
    "2026-07-25T12:10:00.000Z",
  );
  assert.equal(
    tables.marketing_workflow_runs.find((row) => row.id === "wait-run")?.status,
    "active",
  );
  assert.deepEqual(
    tables.marketing_contact_tags.map((row) => row.tag),
    ["customer"],
  );
  assert.equal(
    tables.marketing_workflow_step_runs.find(
      (row) => row.node_id === "suppressed-node",
    )?.status,
    "skipped",
  );
});

test("workflow activity scan matches real CRM and project status rows with a keyset cursor", async () => {
  const sharedTimestamp = "2026-07-25T12:00:00.000Z";
  const laterTimestamp = "2026-07-25T12:01:00.000Z";
  const tables: Tables = {
    marketing_worker_cursors: [{
      key: "activity_triggers",
      cursor: sharedTimestamp,
      cursor_id: "00000000-0000-4000-8000-000000000001",
    }],
    app_activity_events: [
      {
        id: "00000000-0000-4000-8000-000000000002",
        created_at: sharedTimestamp,
        domain: "crm",
        event_type: "crm_contact_status_changed",
        entity_table: "crm_contacts",
        entity_id: "contact-crm",
        payload: {
          contact_id: "contact-crm",
          changes: { status: { from: "lead", to: "customer" } },
        },
      },
      {
        id: "00000000-0000-4000-8000-000000000003",
        created_at: laterTimestamp,
        domain: "projects",
        event_type: "project_status_changed",
        entity_table: "projects",
        entity_id: "project-1",
        payload: {
          project_id: "project-1",
          previous_status: "planned",
          new_status: "active",
        },
      },
    ],
    marketing_workflows: [
      {
        id: "crm-workflow",
        status: "active",
        trigger_type: "crm_status_changed",
        trigger_config: { toStatus: "customer" },
      },
      {
        id: "project-workflow",
        status: "active",
        trigger_type: "project_status_changed",
        trigger_config: { toStatus: "active" },
      },
    ],
    marketing_workflow_runs: [],
    projects: [{ id: "project-1", organization_id: "organization-1" }],
    crm_contacts: [
      { id: "contact-crm", organization_id: null },
      {
        id: "contact-project",
        organization_id: "organization-1",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
  const supabase = fakeSupabase(tables);

  assert.deepEqual(
    await scanActivityTriggers(supabase, { limit: 1 }),
    { scanned: 1, enqueued: 1 },
  );
  assert.equal(
    tables.marketing_worker_cursors[0]?.cursor_id,
    "00000000-0000-4000-8000-000000000002",
  );
  assert.deepEqual(
    await scanActivityTriggers(supabase, { limit: 1 }),
    { scanned: 1, enqueued: 1 },
  );
  assert.deepEqual(
    tables.marketing_workflow_runs.map((row) => ({
      workflow_id: row.workflow_id,
      contact_id: row.contact_id,
    })),
    [
      { workflow_id: "crm-workflow", contact_id: "contact-crm" },
      { workflow_id: "project-workflow", contact_id: "contact-project" },
    ],
  );
});

test("workflow send does not repeat after a crash left the run position stale", async () => {
  const tables: Tables = {
    marketing_workflows: [{ id: "workflow-1", status: "active" }],
    marketing_workflow_nodes: [{
      id: "send-node",
      workflow_id: "workflow-1",
      position: 0,
      node_type: "send_email",
      config: {
        subject: "Already sent",
        bodyText: "Do not repeat",
        topicId: "topic-1",
      },
    }],
    marketing_workflow_runs: [workflowRun({ id: "crashed-run" })],
    marketing_workflow_step_runs: [{
      id: "completed-step",
      run_id: "crashed-run",
      node_id: "send-node",
      status: "done",
    }],
  };
  let sends = 0;
  const sender: MarketingEmailSender = {
    async sendOne() {
      sends += 1;
      return { ok: true, providerMessageId: "unexpected" };
    },
    async sendBatch(messages) {
      sends += messages.length;
      return messages.map(() => ({
        ok: true as const,
        providerMessageId: "unexpected",
      }));
    },
  };

  const result = await processDueWorkflowRuns(
    fakeSupabase(tables),
    { sender, now: () => new Date("2026-07-25T12:00:00.000Z") },
  );

  assert.deepEqual(result, { claimed: 1, completed: 1, failed: 0 });
  assert.equal(sends, 0);
  assert.equal(tables.marketing_workflow_runs[0]?.status, "completed");
  assert.equal(tables.marketing_workflow_runs[0]?.current_position, 1);
});

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

test("test send blocks a suppressed address before calling the sender", async () => {
  const tables: Tables = {
    marketing_campaigns: [campaign()],
    marketing_suppressions: [{ id: "suppression-1", email: "blocked@example.com" }],
  };
  let sends = 0;
  const sender: MarketingEmailSender = {
    async sendOne() {
      sends += 1;
      return { ok: true, providerMessageId: "unexpected" };
    },
    async sendBatch() {
      throw new Error("not used");
    },
  };

  await assert.rejects(
    sendTestEmail(
      fakeSupabase(tables),
      "campaign-1",
      " BLOCKED@example.com ",
      sender,
    ),
    /suppressed/,
  );
  assert.equal(sends, 0);
});

test("topic unsubscribe suppresses queued and sending recipients only for that topic", async () => {
  const tables: Tables = {
    marketing_contact_settings: [{
      contact_id: "contact-1",
      unsubscribe_token: "token-1",
    }],
    crm_contacts: [{
      id: "contact-1",
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
    }],
    marketing_topics: [
      {
        id: "topic-1",
        slug: "news",
        label: "News",
        description: null,
        is_active: true,
        position: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "topic-2",
        slug: "events",
        label: "Events",
        description: null,
        is_active: true,
        position: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    marketing_subscriptions: [
      {
        id: "subscription-1",
        contact_id: "contact-1",
        topic_id: "topic-1",
        status: "subscribed",
        consent_source: "form",
        consent_at: "2026-01-01T00:00:00.000Z",
        unsubscribed_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "subscription-2",
        contact_id: "contact-1",
        topic_id: "topic-2",
        status: "subscribed",
        consent_source: "form",
        consent_at: "2026-01-01T00:00:00.000Z",
        unsubscribed_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    marketing_campaigns: [
      campaign({ id: "campaign-topic-1", topic_id: "topic-1", status: "sending" }),
      campaign({ id: "campaign-topic-2", topic_id: "topic-2", status: "sending" }),
    ],
    marketing_campaign_recipients: [
      {
        id: "recipient-topic-1",
        campaign_id: "campaign-topic-1",
        contact_id: "contact-1",
        email: "ada@example.com",
        status: "queued",
      },
      {
        id: "recipient-topic-2",
        campaign_id: "campaign-topic-2",
        contact_id: "contact-1",
        email: "ada@example.com",
        status: "queued",
      },
    ],
  };

  await unsubscribeTopic(fakeSupabase(tables), "token-1", "topic-1");

  assert.equal(tables.marketing_campaign_recipients[0]?.status, "suppressed");
  assert.equal(tables.marketing_campaign_recipients[1]?.status, "queued");
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
    crm_contacts: [
      { id: "contact-1", email: "one@example.com" },
      { id: "contact-2", email: "two@example.com" },
    ],
    marketing_subscriptions: [
      { contact_id: "contact-1", topic_id: "topic-1", status: "subscribed" },
      { contact_id: "contact-2", topic_id: "topic-1", status: "subscribed" },
    ],
    marketing_suppressions: [],
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
  assert.equal(tables.marketing_campaigns[0]?.status, "sending");
  assert.equal(tables.marketing_campaigns[0]?.sent_count, 1);
  assert.equal(tables.marketing_campaigns[0]?.failed_count, 1);
});

test("worker re-checks consent and suppression after recipients were queued", async () => {
  const tables: Tables = {
    marketing_campaigns: [campaign({ status: "sending", total_recipients: 2 })],
    marketing_campaign_recipients: [
      {
        id: "unsubscribed-recipient",
        campaign_id: "campaign-1",
        contact_id: "contact-1",
        email: "unsubscribed@example.com",
        status: "queued",
        attempt_count: 0,
        next_attempt_at: null,
      },
      {
        id: "suppressed-recipient",
        campaign_id: "campaign-1",
        contact_id: "contact-2",
        email: "suppressed@example.com",
        status: "queued",
        attempt_count: 0,
        next_attempt_at: null,
      },
    ],
    crm_contacts: [
      { id: "contact-1", email: "unsubscribed@example.com" },
      { id: "contact-2", email: "suppressed@example.com" },
    ],
    marketing_subscriptions: [
      { contact_id: "contact-1", topic_id: "topic-1", status: "unsubscribed" },
      { contact_id: "contact-2", topic_id: "topic-1", status: "subscribed" },
    ],
    marketing_suppressions: [{ email: "suppressed@example.com" }],
    marketing_contact_settings: [],
  };
  let sends = 0;
  const sender: MarketingEmailSender = {
    async sendOne() {
      throw new Error("not used");
    },
    async sendBatch(messages) {
      sends += messages.length;
      return messages.map(() => ({
        ok: true as const,
        providerMessageId: "unexpected",
      }));
    },
  };

  const result = await runMarketingWorker({
    supabase: fakeSupabase(tables),
    sender,
    now: () => new Date("2026-07-25T13:00:00.000Z"),
  });

  assert.equal(result.claimed, 2);
  assert.equal(sends, 0);
  assert.deepEqual(
    tables.marketing_campaign_recipients.map((row) => row.status),
    ["suppressed", "suppressed"],
  );
});

test("worker automatically retries a due failed recipient up to the attempt limit", async () => {
  const tables: Tables = {
    marketing_campaigns: [campaign({ status: "sending", total_recipients: 1 })],
    marketing_campaign_recipients: [{
      id: "failed-recipient",
      campaign_id: "campaign-1",
      contact_id: "contact-1",
      email: "retry@example.com",
      status: "failed",
      attempt_count: 1,
      next_attempt_at: "2026-07-25T12:59:00.000Z",
      updated_at: "2026-07-25T12:58:00.000Z",
    }],
    crm_contacts: [{ id: "contact-1", email: "retry@example.com" }],
    marketing_subscriptions: [
      { contact_id: "contact-1", topic_id: "topic-1", status: "subscribed" },
    ],
    marketing_suppressions: [],
    marketing_contact_settings: [],
  };
  const sender: MarketingEmailSender = {
    async sendOne() {
      throw new Error("not used");
    },
    async sendBatch(messages) {
      return messages.map(() => ({
        ok: true as const,
        providerMessageId: "retry-success",
      }));
    },
  };

  const result = await runMarketingWorker({
    supabase: fakeSupabase(tables),
    sender,
    now: () => new Date("2026-07-25T13:00:00.000Z"),
  });

  assert.equal(result.claimed, 1);
  assert.equal(result.sent, 1);
  assert.equal(tables.marketing_campaign_recipients[0]?.attempt_count, 2);
  assert.equal(tables.marketing_campaign_recipients[0]?.status, "sent");
});

test("worker reclaims only stale sending recipients", async () => {
  const tables: Tables = {
    marketing_campaigns: [campaign({ status: "sending", total_recipients: 2 })],
    marketing_campaign_recipients: [
      {
        id: "stale-recipient",
        campaign_id: "campaign-1",
        contact_id: "contact-1",
        email: "stale@example.com",
        status: "sending",
        attempt_count: 1,
        next_attempt_at: null,
        updated_at: "2026-07-25T12:30:00.000Z",
      },
      {
        id: "fresh-recipient",
        campaign_id: "campaign-1",
        contact_id: "contact-2",
        email: "fresh@example.com",
        status: "sending",
        attempt_count: 1,
        next_attempt_at: null,
        updated_at: "2026-07-25T12:55:00.000Z",
      },
    ],
    crm_contacts: [
      { id: "contact-1", email: "stale@example.com" },
      { id: "contact-2", email: "fresh@example.com" },
    ],
    marketing_subscriptions: [
      { contact_id: "contact-1", topic_id: "topic-1", status: "subscribed" },
      { contact_id: "contact-2", topic_id: "topic-1", status: "subscribed" },
    ],
    marketing_suppressions: [],
    marketing_contact_settings: [],
  };
  const sent: string[] = [];
  const sender: MarketingEmailSender = {
    async sendOne() {
      throw new Error("not used");
    },
    async sendBatch(messages) {
      sent.push(...messages.map((message) => message.to));
      return messages.map(() => ({
        ok: true as const,
        providerMessageId: "reclaimed",
      }));
    },
  };

  const result = await runMarketingWorker({
    supabase: fakeSupabase(tables),
    sender,
    now: () => new Date("2026-07-25T13:00:00.000Z"),
  });

  assert.equal(result.claimed, 1);
  assert.deepEqual(sent, ["stale@example.com"]);
  assert.equal(tables.marketing_campaign_recipients[0]?.status, "sent");
  assert.equal(tables.marketing_campaign_recipients[1]?.status, "sending");
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
    marketing_campaign_recipients: [
      {
        id: "recipient-1",
        campaign_id: "campaign-1",
        contact_id: "contact-1",
        email: "bounce@example.com",
        provider_message_id: "provider-1",
        status: "sent",
      },
      {
        id: "recipient-queued",
        campaign_id: "campaign-2",
        contact_id: "contact-1",
        email: "bounce@example.com",
        provider_message_id: null,
        status: "queued",
      },
    ],
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
  assert.equal(tables.marketing_campaign_recipients[1]?.status, "suppressed");
  assert.equal(tables.marketing_suppressions[0]?.email, "bounce@example.com");
  assert.equal(tables.marketing_suppressions[0]?.reason, "bounced");
  assert.equal(tables.marketing_subscriptions[0]?.status, "unsubscribed");
});

test("webhook transaction rolls back an inserted event so a failed delivery mutation can retry", async () => {
  const tables: Tables = {
    marketing_campaign_recipients: [{
      id: "recipient-1",
      campaign_id: "campaign-1",
      contact_id: "contact-1",
      email: "retry@example.com",
      provider_message_id: "provider-retry",
      status: "sent",
    }],
    marketing_message_events: [],
    marketing_suppressions: [],
    marketing_subscriptions: [{ contact_id: "contact-1", topic_id: "topic-1", status: "subscribed" }],
  };
  const secret = `whsec_${Buffer.from("campaign-test-secret-32-bytes!!").toString("base64")}`;
  const body = JSON.stringify({
    type: "email.bounced",
    created_at: "2026-07-25T13:00:00.000Z",
    data: { email_id: "provider-retry", to: ["retry@example.com"] },
  });
  const headers = signedWebhook(body, secret);
  const supabase = fakeSupabase(tables, { failWebhookAfterEventOnce: true });

  await assert.rejects(
    () => processResendWebhook(supabase, body, headers, secret),
    /injected derived mutation failure/,
  );
  assert.equal(tables.marketing_message_events.length, 0);
  assert.equal(tables.marketing_campaign_recipients[0]?.status, "sent");

  const retried = await processResendWebhook(supabase, body, headers, secret);
  assert.equal(retried.duplicate, false);
  assert.equal(tables.marketing_message_events.length, 1);
  assert.equal(tables.marketing_campaign_recipients[0]?.status, "suppressed");
  assert.equal(tables.marketing_suppressions[0]?.email, "retry@example.com");
  assert.equal(tables.marketing_subscriptions[0]?.status, "unsubscribed");
});
