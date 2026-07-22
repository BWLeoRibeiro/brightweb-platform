import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import type { ProjectDashboardData, ProjectLink } from "../packages/module-projects/src/types.ts";
import { defaultProjectsUiDictionary } from "../packages/module-projects/src/ui/dictionary.ts";
import { parseProjectDashboardPayload, parseProjectLinksPayload, projectDetailDataReducer } from "../packages/module-projects/src/ui/project-detail-data-provider.tsx";
import { createProjectsModuleRegistration } from "../packages/module-projects/src/registration.ts";

const project = { id: "project-1", organizationId: "org-1", organizationName: "MQ", organizationOwnerLabel: null, organizationOwnerEmail: null, organizationOwnerPhone: null, name: "Projeto", code: "MQ-1", status: "active", health: "on_track", ownerProfileId: null, ownerLabel: null, ownerEmail: null, ownerPhone: null, activatedAt: null, targetDate: null, completedAt: null, cancellationReason: null, summary: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", taskStats: { total: 0, done: 0, overdue: 0, blocked: 0 }, milestoneStats: { total: 0, achieved: 0, delayed: 0 } } satisfies ProjectDashboardData["project"];
const link = { id: "link-1", projectId: "project-1", label: "Drive", url: "https://example.com", visibility: "staff", kind: "drive", createdAt: project.createdAt, updatedAt: project.updatedAt } satisfies ProjectLink;
const dashboard = { project, members: [], milestones: [], tasks: [], links: [link], activity: [] } satisfies ProjectDashboardData;

test("Projects detail provider accepts package dashboard payloads", () => {
  assert.deepEqual(parseProjectDashboardPayload({ data: dashboard }), dashboard);
  assert.equal(parseProjectDashboardPayload({ data: { project } }), null);
  assert.deepEqual(parseProjectLinksPayload({ data: [link] }), [link]);
  assert.equal(parseProjectLinksPayload({ data: [{ ...link, kind: "spreadsheet" }] }), null);
});

test("Projects detail reducer replaces links without changing the dashboard record", () => {
  const links = [{ ...link, id: "link-2", label: "Brief" }];
  assert.deepEqual(projectDetailDataReducer(dashboard, { type: "replace-links", links }), { ...dashboard, links });
});

test("Projects UI ships Portuguese defaults and configurable shell registration", () => {
  assert.equal(defaultProjectsUiDictionary.locale, "pt-PT");
  assert.equal(defaultProjectsUiDictionary.status.planned, "A planear");
  const registration = createProjectsModuleRegistration("/projects");
  assert.equal(registration.navItems?.[0]?.href, "/projects");
  assert.deepEqual(registration.toolbarActions?.projects?.map((item) => item.action), ["projects-refresh", "projects-new-menu"]);
});

test("Projects package UI contains the literal list/detail translation and no raw component colors", () => {
  const root = join(process.cwd(), "packages/module-projects/src/ui");
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
  const source = files(root).filter((file) => /\.(?:ts|tsx)$/.test(file)).map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i);
  assert.doesNotMatch(source, /\bfont-medium\b/);
  for (const symbol of ["ProjectsPage", "ProjectDetailPage", "ProjectsToolbarControls", "ProjectDetailDataProvider"]) assert.match(readFileSync(join(root, "index.ts"), "utf8"), new RegExp(symbol.replace("ProjectsToolbarControls", "toolbar-controls").replace("ProjectDetailDataProvider", "project-detail-data-provider").replace("ProjectsPage", "projects-page").replace("ProjectDetailPage", "project-detail-page")));
});
