import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const toolbarFiles = [
  "packages/app-shell/src/components/toolbar-shared.tsx",
  "packages/module-admin/src/ui/toolbar-controls.tsx",
  "packages/module-crm/src/ui/toolbar-controls.tsx",
  "packages/module-projects/src/ui/toolbar-controls.tsx",
];

test("shared BrightWeb buttons expose the pointer cursor", async () => {
  const variants = await readFile(
    "packages/ui/src/components/button-variants.ts",
    "utf8",
  );

  assert.match(variants, /inline-flex shrink-0 cursor-pointer/);
});

test("module toolbar native buttons preserve the shared pointer affordance", async () => {
  for (const file of toolbarFiles) {
    const source = await readFile(file, "utf8");
    const buttonTags = source.match(/<button\b[\s\S]*?<\/button>/g) ?? [];

    assert.ok(buttonTags.length > 0, `${file} must contain native toolbar buttons`);
    for (const button of buttonTags) {
      assert.match(
        button,
        /cursor-pointer|controlClassName/,
        `${file} has a button without the shared pointer affordance`,
      );
    }
  }
});
