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

test("project creation follows project, internal team, client access, and review order", async () => {
  const [source, dictionary] = await Promise.all([
    read("packages/module-projects/src/ui/create-project-sheet.tsx"),
    read("packages/module-projects/src/ui/project-access-dictionary.ts"),
  ]);
  const headings = [
    'title: "Projeto e organizações"',
    'title: "Equipa interna"',
    'title: "Acesso de clientes"',
    'title: "Rever e criar"',
  ];
  const wizardDictionary = dictionary.slice(dictionary.indexOf("wizard: {"));
  let previous = -1;
  for (const heading of headings) {
    const index = wizardDictionary.indexOf(heading);
    assert.ok(index > previous, `${heading} should appear in semantic order`);
    previous = index;
  }

  const wizardBody = source.slice(source.indexOf("<WizardProgress step={step}"));
  const stepBranches = ["{step === 1 ? (", "{step === 2 ? (", "{step === 3 ? (", "{step === 4 ? ("];
  previous = -1;
  for (const branch of stepBranches) {
    const index = wizardBody.indexOf(branch, previous + 1);
    assert.ok(index > previous, `${branch} should render in wizard order`);
    previous = index;
  }

  assert.match(source, /projectAccessDictionary\.wizard\.steps\.map/);
  assert.match(source, /<WizardProgress step=\{step\}/);
  assert.match(source, /participatingOrganizationIds/);
  assert.match(source, /<ProjectClientAccessEditor/);
  assert.match(source, /clientAccess: clientAccessDraftToPayload\(clientAccess\)/);
  assert.match(source, /if \(step !== 4 \|\| isSubmitting/);
  assert.match(source, /projectForm\.startDate/);
  assert.match(source, /projectAccessDictionary\.wizard\.invalidDateRange/);
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
