import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("invitation email preview serves its logo from the preview app", async () => {
  const source = await readFile(
    new URL("../apps/platform-preview/app/preview/invitation-email/brand.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /logoUrl: "\/brand\/logo-dark\.svg"/);
  assert.doesNotMatch(source, /localhost:3001\/brand\/logo-email\.png/);
});
