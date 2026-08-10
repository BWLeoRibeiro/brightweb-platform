import assert from "node:assert/strict";
import test from "node:test";

import { resolveProjectCreationIntent } from "./project-create-intent.ts";

test("project creation intent survives direct and new-tab navigation, then clears from the URL", () => {
  assert.deepEqual(
    resolveProjectCreationIntent("https://portal.example/projetos?view=grid&create=project#recent"),
    { shouldOpen: true, nextHref: "/projetos?view=grid#recent" },
  );
  assert.deepEqual(
    resolveProjectCreationIntent("https://portal.example/projetos?create=contact"),
    { shouldOpen: false, nextHref: null },
  );
});
