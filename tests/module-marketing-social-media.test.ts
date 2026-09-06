import assert from "node:assert/strict";
import test from "node:test";
import { calendarDays, filterPublications, publicationMonths, safeSocialMediaHref } from "../packages/module-marketing/src/social-media/model.ts";
import type { SocialMediaPublication } from "../packages/module-marketing/src/social-media/types.ts";

const event = (date: string, type = "insight"): SocialMediaPublication => ({
  id: date, date, type, title: "Publication", channels: "LinkedIn", format: "Post", summary: "Summary", interaction: "Question", cta: "Read", baseText: "Draft", service: "Service", editorialNote: "Note", references: [],
});

test("calendar is Monday-first and includes both adjacent-month boundaries", () => {
  const days = calendarDays("2026-09");
  assert.equal(days[0].date, "2026-08-31");
  assert.equal(days.at(-1)?.date, "2026-10-04");
  assert.equal(days.filter((day) => day.inMonth).length, 30);
  assert.equal(days[1].day, 1);
  assert.equal(calendarDays("2028-02").filter((day) => day.inMonth).length, 29);
  assert.deepEqual(calendarDays(""), []);
});

test("filters preserve co-dated website and social posts, month years, and empty/reverse states", () => {
  const events = [event("2026-10-01"), event("2026-09-10", "website"), event("2026-09-10"), event("2027-09-01")];
  assert.deepEqual(publicationMonths(events), ["2026-09", "2026-10", "2027-09"]);
  assert.equal(filterPublications(events, "2026-09", "all").length, 2);
  assert.equal(filterPublications(events, "2026-09", "website").length, 1);
  assert.equal(filterPublications(events, "2026-10", "website").length, 0);
  assert.equal(filterPublications(events, "2026-10", "all").length, 1);
  assert.equal(filterPublications(events, "2027-09", "all").length, 1);
});

test("reference links reject executable and local URLs", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,hello", "file:///tmp/test", "/private", "//example.com", undefined]) {
    assert.equal(safeSocialMediaHref(href), undefined);
  }
  assert.equal(safeSocialMediaHref("https://example.com/source"), "https://example.com/source");
});

test("client-defined publication categories supply labels, medium counts and visual tone", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { SocialMediaClient } = await import("../packages/module-marketing/src/social-media/social-media-client.tsx");
  const html = renderToStaticMarkup(createElement(SocialMediaClient, { plan: {
    title: "Library", period: "2027", sections: [{ id: "calendario", title: "Calendar" }],
    types: { annualReport: { label: "Annual report", medium: "website", tone: "info" } },
    events: [{ ...event("2027-04-01", "annualReport"), title: "Library report", channels: "Library website" }],
  } }));
  assert.ok(html.includes("Annual report"));
  assert.ok(html.includes("0 nas redes · 1 no website"));
  assert.ok(html.includes('data-tone="info"'));
  assert.ok(!html.includes("BeGreen"));
  assert.ok(!html.includes("Insight"));
});
