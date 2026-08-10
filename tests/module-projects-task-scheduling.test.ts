import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("project task scheduling migration adds start date and guards the date range", async () => {
  const migration = await read("supabase/modules/projects/migrations/20260804120000_project_task_start_date.sql");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS start_date date/);
  assert.match(migration, /due_date >= start_date/);

  const templateMigration = await read("packages/create-bw-app/template/supabase/modules/projects/migrations/20260804120000_project_task_start_date.sql");
  assert.equal(templateMigration, migration);
});

test("project scheduling migration adds start date and guards the date range", async () => {
  const migration = await read("supabase/modules/projects/migrations/20260804123000_project_start_date.sql");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS start_date date/);
  assert.match(migration, /target_date >= start_date/);

  const templateMigration = await read("packages/create-bw-app/template/supabase/modules/projects/migrations/20260804123000_project_start_date.sql");
  assert.equal(templateMigration, migration);
});

test("all task sheet surfaces use the shared four-section hierarchy", async () => {
  const surfaces = await Promise.all([
    read("packages/module-projects/src/ui/create-project-task-sheet.tsx"),
    read("packages/module-projects/src/ui/project-detail-create-sheets/project-task-create-sheet.tsx"),
    read("packages/module-projects/src/ui/project-board-kanban.tsx"),
    read("packages/module-projects/src/ui/project-detail-editable-cards.tsx"),
  ]);

  for (const source of surfaces) {
    assert.match(source, /dictionary\.board\.contentSection/);
    assert.match(source, /dictionary\.board\.executionSection/);
    assert.match(source, /dictionary\.board\.planningSection/);
    assert.match(source, /dictionary\.board\.calendarSection/);
    assert.match(source, /startDate/);
  }
});

test("task contracts and server persistence expose startDate", async () => {
  const [types, http, server] = await Promise.all([
    read("packages/module-projects/src/types.ts"),
    read("packages/module-projects/src/http.ts"),
    read("packages/module-projects/src/server.ts"),
  ]);
  assert.match(types, /startDate: string \| null/);
  assert.match(http, /"startDate"/);
  assert.match(server, /start_date: input\.startDate \?\? null/);
  assert.match(server, /A data limite não pode ser anterior à data de início/);
});

test("project contracts, UI, and server persistence expose startDate", async () => {
  const [types, http, server, createSheet, editSheet] = await Promise.all([
    read("packages/module-projects/src/types.ts"),
    read("packages/module-projects/src/http.ts"),
    read("packages/module-projects/src/server.ts"),
    read("packages/module-projects/src/ui/create-project-sheet.tsx"),
    read("packages/module-projects/src/ui/project-edit-sheet.tsx"),
  ]);
  assert.match(types, /startDate\?: string \| null/);
  assert.match(http, /"startDate"/);
  assert.match(server, /start_date: input\.startDate \?\? null/);
  assert.match(server, /A data alvo não pode ser anterior à data de início/);
  assert.match(createSheet, /projectForm\.startDate/);
  assert.match(editSheet, /projectEdit\.startDate/);
});
