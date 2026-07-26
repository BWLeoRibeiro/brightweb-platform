import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateMarketingMetrics,
  emptyMarketingMetrics,
} from "../packages/module-marketing/src/analytics";

test("marketing analytics dedupe engagement events to unique recipients", () => {
  const metrics = aggregateMarketingMetrics(5, [
    { id: "delivered-1", recipient_id: "recipient-1", event_type: "delivered" },
    { id: "delivered-2", recipient_id: "recipient-2", event_type: "delivered" },
    { id: "delivered-3", recipient_id: "recipient-3", event_type: "delivered" },
    { id: "delivered-4", recipient_id: "recipient-4", event_type: "delivered" },
    { id: "open-1", recipient_id: "recipient-1", event_type: "opened" },
    { id: "open-2", recipient_id: "recipient-1", event_type: "opened" },
    { id: "open-3", recipient_id: "recipient-2", event_type: "opened" },
    { id: "open-4", recipient_id: "recipient-3", event_type: "opened" },
    { id: "click-1", recipient_id: "recipient-1", event_type: "clicked" },
    { id: "click-2", recipient_id: "recipient-1", event_type: "clicked" },
    { id: "click-3", recipient_id: "recipient-2", event_type: "clicked" },
    { id: "bounce-1", recipient_id: "recipient-5", event_type: "bounced" },
    { id: "unsubscribe-1", recipient_id: "recipient-4", event_type: "unsubscribed" },
    { id: "complaint-1", recipient_id: "recipient-3", event_type: "complained" },
    { id: "ignored", recipient_id: "recipient-1", event_type: "unknown" },
  ]);

  assert.deepEqual(
    {
      sent: metrics.sent,
      delivered: metrics.delivered,
      opened: metrics.opened,
      clicked: metrics.clicked,
      bounced: metrics.bounced,
      unsubscribed: metrics.unsubscribed,
      complained: metrics.complained,
    },
    {
      sent: 5,
      delivered: 4,
      opened: 3,
      clicked: 2,
      bounced: 1,
      unsubscribed: 1,
      complained: 1,
    },
  );
  assert.equal(metrics.openRate, 75);
  assert.equal(metrics.clickRate, 50);
  assert.equal(metrics.bounceRate, 20);
  assert.equal(metrics.unsubRate, 20);
  assert.equal(metrics.complaintRate, 20);
  assert.equal(metrics.rawEventTotals.opened, 4);
  assert.equal(metrics.rawEventTotals.clicked, 3);
});

test("marketing analytics uses sent as the engagement base before delivery events arrive", () => {
  const metrics = aggregateMarketingMetrics(4, [
    { id: "open-1", recipient_id: "recipient-1", event_type: "opened" },
    { id: "click-1", recipient_id: "recipient-1", event_type: "clicked" },
  ]);

  assert.equal(metrics.openRate, 25);
  assert.equal(metrics.clickRate, 25);
});

test("empty marketing analytics return stable zero counts and rates", () => {
  assert.deepEqual(aggregateMarketingMetrics(0, []), emptyMarketingMetrics());
});
