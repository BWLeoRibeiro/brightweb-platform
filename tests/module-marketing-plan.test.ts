import assert from "node:assert/strict";
import test from "node:test";
import { parseSocialMediaPlan } from "../packages/module-marketing/src/social-media/validate-plan.ts";

const plan = () => ({
  title: "Harbour Museum", period: "Spring 2028",
  sections: [{ id: "calendario", title: "Exhibitions" }],
  types: { exhibition: { label: "New exhibition", medium: "social", tone: "info" } },
  events: [{ id: "opening", date: "2028-02-29", type: "exhibition", title: "The harbour in colour", channels: "Instagram", format: "Photo essay", summary: "Introduce the collection", interaction: "Share a memory", cta: "Visit", baseText: "Discover the waterfront", service: "Museum admission", editorialNote: "Use archive photographs", references: [["Archive", "https://example.org/archive"]] }],
});

test("a second website can supply an independent calendar with all strategy sections omitted", () => {
  const input = plan();
  assert.equal(parseSocialMediaPlan(input), input);
  assert.equal(parseSocialMediaPlan(input).positioning, undefined);
  assert.equal(parseSocialMediaPlan(input).measurement, undefined);
});

test("structured optional sections accept different cadence, channels and measurement areas", () => {
  const input = { ...plan(),
    sections: [...plan().sections, { id: "plano", title: "Our approach" }, { id: "metricas", title: "Learning" }],
    editorial: { eyebrow: "Editorial", title: "Tell local stories", introduction: "A story per exhibition" },
    positioning: { headline: "Local history", statement: "Make the archive accessible", principles: [] },
    measurement: { period: "Spring", title: "Visitor interest", introduction: "Start with questions", deliverables: [], signals: [{ title: "Visits", question: "Did visitors attend?", indicators: ["Ticket enquiries"], interpretation: "Count enquiries", icon: "conversation" }], decisions: [], routine: "Review after each exhibition" },
  };
  assert.equal(parseSocialMediaPlan(input).measurement?.signals[0].indicators[0], "Ticket enquiries");
});

test("invalid dates, duplicate publications, and missing publication types fail before rendering", () => {
  for (const date of ["2027-02-29", "2028-13-01", "2028-2-01", "2028-02-30"]) {
    const input = plan(); input.events[0].date = date;
    assert.throws(() => parseSocialMediaPlan(input), /real date/);
  }
  const duplicate = plan(); duplicate.events.push({ ...duplicate.events[0] });
  assert.throws(() => parseSocialMediaPlan(duplicate), /unique/);
  const missing = plan(); missing.events[0].type = "unconfigured";
  assert.throws(() => parseSocialMediaPlan(missing), /not configured/);
});

test("sections cannot expose missing content or silently hide provided content", () => {
  const missing = plan(); missing.sections.push({ id: "plano", title: "Editorial" });
  assert.throws(() => parseSocialMediaPlan(missing), /provided together/);
  assert.throws(() => parseSocialMediaPlan({ ...plan(), campaigns: { eyebrow: "Launches", title: "Summer", introduction: "Exhibitions", items: [] } }), /provided together/);
  const duplicate = plan(); duplicate.sections.push(duplicate.sections[0]);
  assert.throws(() => parseSocialMediaPlan(duplicate), /duplicate section/);
  assert.throws(() => parseSocialMediaPlan({ ...plan(), sections: [] }), /calendar section/);
});

test("legacy markup fields and executable links are rejected without exposing their content", () => {
  assert.throws(() => parseSocialMediaPlan({ ...plan(), summary: [{ tag: "script", attrs: {}, children: ["secret"] }] }), /unexpected field/);
  const input = plan(); input.events[0].references[0][1] = "javascript:secret";
  assert.throws(() => parseSocialMediaPlan(input), error => error instanceof Error && /HTTP/.test(error.message) && !error.message.includes("secret"));
  assert.throws(() => parseSocialMediaPlan({ ...plan(), editorial: { eyebrow: "Strategy", title: "Stories", introduction: "Text", class: "client-layout" } }), /unexpected field/);
});

test("malformed nested data, unsupported presentation options and reserved filter keys fail", () => {
  assert.throws(() => parseSocialMediaPlan(null), /expected an object/);
  assert.throws(() => parseSocialMediaPlan({ ...plan(), events: {} }), /expected an array/);
  assert.throws(() => parseSocialMediaPlan({ ...plan(), types: { all: { label: "All", medium: "social" } } }), /reserved/);
  assert.throws(() => parseSocialMediaPlan({ ...plan(), types: { exhibition: { label: "Exhibition", medium: "social", tone: "red-css-class" } } }), /unsupported option/);
  assert.throws(() => parseSocialMediaPlan({ ...plan(), holidays: { "2028-02-30": "Invalid" } }), /real date/);
});
