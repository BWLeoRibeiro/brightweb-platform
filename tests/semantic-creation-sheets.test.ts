import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("CRM creation sheets use entity-specific semantic sections", async () => {
  const [contact, organization] = await Promise.all([
    read("packages/module-crm/src/ui/contact-dialog.tsx"),
    read("packages/module-crm/src/ui/organization-sheet.tsx"),
  ]);
  assert.match(contact, /contactDialog\.identity/);
  assert.match(contact, /contactDialog\.contactDetails/);
  assert.match(contact, /contactDialog\.relationship/);
  assert.match(contact, /contactDialog\.pipeline/);
  assert.match(contact, /<SheetSelect id=\{`\$\{fieldId\}-status`\}/);
  assert.doesNotMatch(contact, /resolvedStages\.map\(\(stage\) => <button/);
  assert.doesNotMatch(contact, /<select/);
  assert.doesNotMatch(organization, /<select/);
  assert.match(organization, /organizations\.identity/);
  assert.match(organization, /organizations\.location/);
  assert.match(organization, /organizations\.profile/);
});

test("project creation separates context, content, execution, and calendar", async () => {
  const source = await read("packages/module-projects/src/ui/create-project-sheet.tsx");
  const headings = [
    "dictionary.projectCreate.context",
    "dictionary.board.contentSection",
    "dictionary.board.executionSection",
    "dictionary.board.calendarSection",
  ];
  let previous = -1;
  for (const heading of headings) {
    const index = source.indexOf(heading);
    assert.ok(index > previous, `${heading} should appear in semantic order`);
    previous = index;
  }
  assert.match(source, /projectForm\.startDate/);
  assert.match(source, /projectEdit\.invalidDateRange/);
});

test("creation sheets use the shared styled selector popup", async () => {
  const [select, appSheet, projectFields] = await Promise.all([
    read("packages/ui/src/components/select.tsx"),
    read("packages/app-shell/src/components/app-sheet.tsx"),
    read("packages/module-projects/src/ui/project-create/shared-fields.tsx"),
  ]);
  assert.match(select, /SelectPrimitive\.Content/);
  assert.match(select, /rounded-xl/);
  assert.match(select, /SelectPrimitive\.ItemIndicator/);
  assert.match(appSheet, /export function SheetSelect/);
  assert.match(projectFields, /<SheetSelect/);
});

test("package and app UI do not fall back to native select popups", async () => {
  const { glob } = await import("node:fs/promises");
  const offenders: string[] = [];
  for await (const path of glob(["packages/**/*.{tsx,jsx}", "apps/**/*.{tsx,jsx}"], { cwd: root })) {
    const source = await read(path);
    if (source.includes("<select")) offenders.push(path);
  }
  assert.deepEqual(offenders, []);
});
