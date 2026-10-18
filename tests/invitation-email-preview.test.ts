import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";

import { invitationEmailPreviewBrand } from "../apps/platform-preview/app/preview/invitation-email/brand.ts";

test("invitation email preview serves its logo from an existing preview-owned asset", async () => {
  const { logoUrl } = invitationEmailPreviewBrand;
  assert.match(logoUrl, /^\/(?!\/)/, "the logo must use the preview's origin, not an external development server");
  const publicRoot = new URL("../apps/platform-preview/public/", import.meta.url);
  const asset = new URL(`.${logoUrl}`, publicRoot);
  assert.ok(asset.href.startsWith(publicRoot.href), "the logo must stay inside the preview's public assets");
  assert.equal((await stat(asset)).isFile(), true);
});
