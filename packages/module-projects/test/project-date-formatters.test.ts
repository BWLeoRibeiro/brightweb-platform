import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  addProjectCalendarDays,
  formatElapsedSince,
  formatProjectDayMonth,
  formatProjectDayOfMonth,
  formatProjectDate,
  formatProjectDateTime,
  formatProjectMonthYear,
  formatProjectShortDate,
  formatProjectWeekday,
  getProjectCalendarDayDifference,
  getProjectDateKey,
  isProjectDatePast,
} from "../src/ui/shared/formatters.ts";
import { useProjectsNow } from "../src/ui/shared/use-projects-now.ts";

const timestamp = "2026-08-14T23:42:37.280695+00:00";

test("project timestamps render in the configured product timezone", () => {
  const previousTimeZone = process.env.TZ;

  try {
    process.env.TZ = "UTC";
    assert.equal(formatProjectDateTime(timestamp), "15/08, 00:42");
    assert.equal(formatProjectDate(timestamp), "15/08/2026");
    assert.equal(formatProjectShortDate(timestamp), "15/08/2026");
    assert.equal(formatProjectMonthYear(timestamp), "agosto de 2026");
    assert.equal(formatProjectDayMonth(timestamp), "15/08");
    assert.equal(formatProjectDayOfMonth(timestamp), "15");
    assert.equal(formatProjectWeekday(timestamp), "sábado");

    process.env.TZ = "America/New_York";
    assert.equal(formatProjectDateTime(timestamp), "15/08, 00:42");
    assert.equal(formatProjectDate(timestamp), "15/08/2026");
    assert.equal(formatProjectShortDate(timestamp), "15/08/2026");
    assert.equal(formatProjectMonthYear(timestamp), "agosto de 2026");
    assert.equal(formatProjectDayMonth(timestamp), "15/08");
    assert.equal(formatProjectDayOfMonth(timestamp), "15");
    assert.equal(formatProjectWeekday(timestamp), "sábado");
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
});

test("relative project dates require an explicit hydration-safe clock", () => {
  const now = new Date("2026-08-15T00:30:00.000Z");

  assert.equal(getProjectDateKey(now), "2026-08-15");
  assert.equal(getProjectCalendarDayDifference("2026-08-14", now), -1);
  assert.equal(getProjectCalendarDayDifference("2026-08-16", now), 1);
  assert.equal(getProjectCalendarDayDifference("2026-08-16", null), null);
  assert.equal(isProjectDatePast("2026-08-14", now), true);
  assert.equal(isProjectDatePast("2026-08-14", null), false);
  assert.equal(formatElapsedSince("2026-08-14T23:00:00.000Z", now), "1 h");
  assert.equal(formatElapsedSince("2026-08-14T23:00:00.000Z", null), "-");
});

test("Lisbon calendar arithmetic does not inherit the browser timezone or DST", () => {
  const previousTimeZone = process.env.TZ;

  try {
    process.env.TZ = "America/New_York";
    const now = new Date("2025-03-04T00:00:00.000Z");
    assert.equal(getProjectDateKey(now), "2025-03-04");
    assert.equal(addProjectCalendarDays(now, 6), "2025-03-10");

    const lisbonAfterMidnight = new Date("2026-08-14T23:30:00.000Z");
    assert.equal(getProjectDateKey(lisbonAfterMidnight), "2026-08-15");
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
});

test("server rendering never reads the live clock for elapsed project time", () => {
  function ElapsedTimeProbe() {
    return createElement("span", null, formatElapsedSince(timestamp, useProjectsNow()));
  }

  assert.equal(renderToString(createElement(ElapsedTimeProbe)), "<span>-</span>");
});
