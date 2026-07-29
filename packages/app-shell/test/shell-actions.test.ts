import assert from "node:assert/strict";
import test from "node:test";

import { ShellActionRegistry } from "../src/lib/shell-action-registry.ts";

test("register makes an action ready and notifies subscribers", () => {
  const registry = new ShellActionRegistry();
  let notified = 0;
  registry.subscribe(() => { notified += 1; });

  assert.equal(registry.isReady("crm:create"), false);
  registry.register("crm:create", () => {});
  assert.equal(registry.isReady("crm:create"), true);
  assert.equal(notified, 1);
  assert.deepEqual([...registry.getRegisteredTypes()], ["crm:create"]);
});

test("unregister makes the action not ready again", () => {
  const registry = new ShellActionRegistry();
  const unregister = registry.register("projects:refresh", () => {});
  assert.equal(registry.isReady("projects:refresh"), true);

  unregister();
  assert.equal(registry.isReady("projects:refresh"), false);
  assert.equal(registry.getRegisteredTypes().size, 0);
});

test("invoke calls the registered handler exactly once with the detail", () => {
  const registry = new ShellActionRegistry();
  const calls: unknown[] = [];
  registry.register("crm:set-search", (detail) => calls.push(detail));

  assert.equal(registry.invoke("crm:set-search", { search: "ada" }), true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { search: "ada" });
});

test("invoke returns false and calls nothing when no handler is registered", () => {
  const registry = new ShellActionRegistry();
  assert.equal(registry.invoke("missing:action"), false);
});

test("latest registration wins and stale unregister does not remove the live handler", () => {
  const registry = new ShellActionRegistry();
  const calls: string[] = [];
  const unregisterFirst = registry.register("crm:create", () => calls.push("first"));
  registry.register("crm:create", () => calls.push("second"));

  registry.invoke("crm:create");
  assert.deepEqual(calls, ["second"]);

  // Stale disposer from the replaced registration must not evict the live handler.
  unregisterFirst();
  assert.equal(registry.isReady("crm:create"), true);
  registry.invoke("crm:create");
  assert.deepEqual(calls, ["second", "second"]);
});

test("StrictMode-style register/unregister/register keeps exactly one live handler", () => {
  const registry = new ShellActionRegistry();
  const calls: number[] = [];
  const handler = () => calls.push(1);

  const first = registry.register("admin:refresh", handler);
  first();
  const second = registry.register("admin:refresh", handler);

  assert.equal(registry.isReady("admin:refresh"), true);
  registry.invoke("admin:refresh");
  assert.equal(calls.length, 1);

  second();
  assert.equal(registry.isReady("admin:refresh"), false);
});

test("aliases resolve toolbar action ids onto registered event types", () => {
  const registry = new ShellActionRegistry({ "projects-refresh": "projects:refresh" });
  let calls = 0;
  registry.register("projects:refresh", () => { calls += 1; });

  assert.equal(registry.isReady("projects-refresh"), true);
  assert.equal(registry.invoke("projects-refresh"), true);
  assert.equal(calls, 1);
  assert.equal(registry.resolveType("projects-refresh"), "projects:refresh");
  assert.equal(registry.resolveType("unmapped"), "unmapped");
});

test("areReady requires every action and honors aliases", () => {
  const registry = new ShellActionRegistry({ "projects-refresh": "projects:refresh" });
  registry.register("projects:refresh", () => {});
  registry.register("projects:set-search", () => {});

  assert.equal(registry.areReady(["projects-refresh", "projects:set-search"]), true);
  assert.equal(registry.areReady(["projects-refresh", "projects:set-health"]), false);
});

test("subscribers stop being notified after unsubscribe", () => {
  const registry = new ShellActionRegistry();
  let notified = 0;
  const unsubscribe = registry.subscribe(() => { notified += 1; });
  registry.register("a", () => {});
  unsubscribe();
  registry.register("b", () => {});
  assert.equal(notified, 1);
});

test("getRegisteredTypes returns a stable snapshot per change", () => {
  const registry = new ShellActionRegistry();
  registry.register("a", () => {});
  const snapshot = registry.getRegisteredTypes();
  assert.equal(registry.getRegisteredTypes(), snapshot);
  registry.register("b", () => {});
  assert.notEqual(registry.getRegisteredTypes(), snapshot);
  assert.deepEqual([...registry.getRegisteredTypes()].sort(), ["a", "b"]);
});
