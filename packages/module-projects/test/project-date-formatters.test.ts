import assert from "node:assert/strict";
import test from "node:test";
import {
  formatProjectDate,
  formatProjectDateTime,
  formatProjectMonthYear,
  formatProjectShortDate,
} from "../src/ui/shared/formatters.ts";

const timestamp = "2026-08-14T23:42:37.280695+00:00";

test("project timestamps render in the configured product timezone", () => {
  const previousTimeZone = process.env.TZ;

  try {
    process.env.TZ = "UTC";
    assert.equal(formatProjectDateTime(timestamp), "15/08, 00:42");
    assert.equal(formatProjectDate(timestamp), "15/08/2026");
    assert.equal(formatProjectShortDate(timestamp), "15/08/2026");
    assert.equal(formatProjectMonthYear(timestamp), "agosto de 2026");

    process.env.TZ = "America/New_York";
    assert.equal(formatProjectDateTime(timestamp), "15/08, 00:42");
    assert.equal(formatProjectDate(timestamp), "15/08/2026");
    assert.equal(formatProjectShortDate(timestamp), "15/08/2026");
    assert.equal(formatProjectMonthYear(timestamp), "agosto de 2026");
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
});
