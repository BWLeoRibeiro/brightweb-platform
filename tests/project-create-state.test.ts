import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { reconcileLoadedOrganizationOptions, upsertOrganizationOption } from "../packages/module-projects/src/ui/project-create/organization-options.ts";
import { useProjectFormState } from "../packages/module-projects/src/ui/project-create/use-project-form-state.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("project form reset clears the complete draft and restores the default organization", async () => {
  const organizations = [
    { id: "org-default", name: "Alfa" },
    { id: "org-other", name: "Beta" },
  ];
  let form: ReturnType<typeof useProjectFormState> | undefined;

  function Harness() {
    form = useProjectFormState(organizations);
    return null;
  }

  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(React.createElement(Harness));
  });

  await act(async () => {
    form!.setOrganizationId("org-other");
    form!.setName("Draft project");
    form!.setCode("CUSTOM-CODE");
    form!.setCodeTouched(true);
    form!.setStatus("active");
    form!.setCancellationReason("Draft reason");
    form!.setStartDate("2026-08-01");
    form!.setTargetDate("2026-08-31");
    form!.setSummary("Draft summary");
  });

  const refreshedOrganizations = [
    { id: "org-new-first", name: "AAA newly created" },
    ...organizations,
  ];
  await act(async () => {
    form!.resetProjectForm(refreshedOrganizations, "org-default");
  });

  assert.equal(form!.organizationId, "org-default");
  assert.equal(form!.name, "");
  assert.equal(form!.code, "");
  assert.equal(form!.codeTouched, false);
  assert.equal(form!.status, "planned");
  assert.equal(form!.cancellationReason, "");
  assert.equal(form!.startDate, "");
  assert.equal(form!.targetDate, "");
  assert.equal(form!.summary, "");

  await act(async () => renderer!.unmount());
});

test("organization handoff replaces duplicate ids and keeps Portuguese name ordering", () => {
  const options = upsertOrganizationOption(
    [
      { id: "org-z", name: "Zulu" },
      { id: "org-created", name: "Old name" },
      { id: "org-a", name: "Árvore" },
    ],
    { id: "org-created", name: "Beta" },
  );

  assert.deepEqual(options, [
    { id: "org-a", name: "Árvore" },
    { id: "org-created", name: "Beta" },
    { id: "org-z", name: "Zulu" },
  ]);
});

test("a late organization-list response preserves the organization created while loading", () => {
  const staleListResponse = [
    { id: "org-existing", name: "Existing" },
  ];
  const createdWhileLoading = { id: "org-created", name: "Created" };

  assert.deepEqual(
    reconcileLoadedOrganizationOptions(staleListResponse, createdWhileLoading),
    [
      { id: "org-created", name: "Created" },
      { id: "org-existing", name: "Existing" },
    ],
  );
  assert.equal(reconcileLoadedOrganizationOptions(staleListResponse, null), staleListResponse);
});
