import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

import {
  MODULE_STARTER_FILES,
  SELECTABLE_MODULES,
} from "../packages/create-bw-app/src/constants.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dashboardClientPath = path.join(
  repoRoot,
  "packages/create-bw-app/template/base/app/(shell)/dashboard/dashboard-live-mount.tsx",
);

function collectRegisteredDashboardSections(source: string, filePath: string) {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sections = new Set<string>();

  function visit(node: ts.Node) {
    if (
      ts.isPropertyAssignment(node)
      && node.name.getText(sourceFile) === "dashboardContribution"
      && ts.isObjectLiteralExpression(node.initializer)
    ) {
      const sectionProperty = node.initializer.properties.find((property) =>
        ts.isPropertyAssignment(property) && property.name.getText(sourceFile) === "sections");
      if (
        sectionProperty
        && ts.isPropertyAssignment(sectionProperty)
        && ts.isArrayLiteralExpression(sectionProperty.initializer)
      ) {
        for (const element of sectionProperty.initializer.elements) {
          if (ts.isStringLiteral(element)) sections.add(element.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...sections];
}

test("every first-party dashboard section has a tracked scaffold endpoint and client method", async () => {
  const dashboardClient = await readFile(dashboardClientPath, "utf8");
  assert.doesNotMatch(dashboardClient, /Promise\.reject|No aggregate dashboard endpoint|No task dashboard endpoint/);

  for (const moduleDefinition of SELECTABLE_MODULES) {
    const packageFolder = moduleDefinition.packageName.split("/").at(-1);
    assert.ok(packageFolder);
    const registrationPath = path.join(repoRoot, "packages", packageFolder, "src/registration.ts");
    const registrationSource = await readFile(registrationPath, "utf8");
    const sections = collectRegisteredDashboardSections(registrationSource, registrationPath);

    for (const section of sections) {
      const relativeRoute = `app/api/dashboard/${section}/route.ts`;
      assert.ok(
        MODULE_STARTER_FILES[moduleDefinition.key]?.includes(relativeRoute),
        `Dashboard section "${section}" from ${moduleDefinition.key} is not tracked in MODULE_STARTER_FILES.`,
      );

      const endpointPath = path.join(
        repoRoot,
        "packages/create-bw-app/template/modules",
        moduleDefinition.templateFolder,
        relativeRoute,
      );
      await assert.doesNotReject(
        access(endpointPath),
        `Dashboard section "${section}" from ${moduleDefinition.key} has no scaffolded endpoint at ${endpointPath}.`,
      );

      const method = `get${section[0]!.toUpperCase()}${section.slice(1)}`;
      assert.match(
        dashboardClient,
        new RegExp(`${method}:\\s*\\(options\\)\\s*=>\\s*getJson\\("/api/dashboard/${section}",\\s*options\\?\\.signal\\)`),
        `Dashboard section "${section}" from ${moduleDefinition.key} has no matching ${method} client method.`,
      );
    }
  }
});
