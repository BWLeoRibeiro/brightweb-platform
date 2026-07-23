import assert from "node:assert/strict";
import test from "node:test";
import {
  createShellNavState,
  getActiveShellNavGroupKeys,
  shellNavStateReducer,
  type ShellNavStateGroup,
} from "../packages/app-shell/src/use-shell-nav-state.ts";

const groups: ShellNavStateGroup[] = [
  {
    key: "tools",
    items: [{ href: "/signature" }],
  },
  {
    key: "crm",
    items: [
      { href: "/crm" },
      { href: "/crm/report" },
    ],
  },
];

function navigate(state: ReturnType<typeof createShellNavState>, pathname: string) {
  return shellNavStateReducer(state, {
    type: "sync-pathname",
    activeGroupKeys: getActiveShellNavGroupKeys(pathname, groups),
  });
}

test("group headers toggle their registered key", () => {
  const initial = createShellNavState("/projects", groups);
  const open = shellNavStateReducer(initial, { type: "toggle-group", key: "crm" });
  const closed = shellNavStateReducer(open, { type: "toggle-group", key: "crm" });

  assert.equal(open.openGroups.crm, true);
  assert.equal(closed.openGroups.crm, false);
});

test("clicking a group while collapsed expands the rail and opens that group", () => {
  const collapsed = shellNavStateReducer(
    createShellNavState("/projects", groups),
    { type: "toggle-sidebar" },
  );
  const open = shellNavStateReducer(collapsed, { type: "toggle-group", key: "crm" });

  assert.equal(open.isSidebarCollapsed, false);
  assert.equal(open.openGroups.crm, true);
});

test("collapsing the rail resets tools and all registered nav groups", () => {
  let state = createShellNavState("/projects", groups);
  state = shellNavStateReducer(state, { type: "toggle-group", key: "tools" });
  state = shellNavStateReducer(state, { type: "toggle-group", key: "crm" });
  state = shellNavStateReducer(state, { type: "toggle-sidebar" });

  assert.equal(state.isSidebarCollapsed, true);
  assert.deepEqual(state.openGroups, {});
});

test("navigating outside an open group closes it", () => {
  const onCrm = createShellNavState("/crm", groups);
  const onProjects = navigate(onCrm, "/projects");

  assert.equal(onCrm.openGroups.crm, true);
  assert.equal(onProjects.openGroups.crm, false);
});

test("an active group opens and stays open across its child routes", () => {
  const onCrm = createShellNavState("/crm", groups);
  const onCrmReport = navigate(onCrm, "/crm/report");

  assert.equal(onCrm.openGroups.crm, true);
  assert.equal(onCrmReport.openGroups.crm, true);
});
