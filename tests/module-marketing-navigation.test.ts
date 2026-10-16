import assert from "node:assert/strict";
import test from "node:test";
import type { ShellModuleRegistration } from "../packages/app-shell/src/types.ts";
import { marketingModuleRegistration, withSocialMediaNavigation } from "../packages/module-marketing/src/registration.ts";

function registration(): ShellModuleRegistration {
  return {
    key: "marketing",
    moduleGroups: marketingModuleRegistration.moduleGroups,
  };
}

test("Social Media navigation is opt-in, staff-only, and does not mutate the input", () => {
  const input = registration();
  const original = input.moduleGroups![0];
  Object.freeze(original.children[0]);
  Object.freeze(original.children);
  Object.freeze(original);
  Object.freeze(input.moduleGroups);
  Object.freeze(input);
  const result = withSocialMediaNavigation()(input);
  assert.equal(input.moduleGroups![0].children.length, 1);
  assert.deepEqual(result.moduleGroups![0].children[0].activeMatch, { exact: ["/marketing"] });
  const social = result.moduleGroups![0].children[1];
  assert.equal(social.href, "/marketing/social-media");
  assert.equal(social.visibility, "staff");
  assert.deepEqual(social.activeMatch, { exact: ["/marketing/social-media"] });
});

test("composes prior customizations and preserves unrelated groups and items", () => {
  const input = registration();
  const campaign = { ...input.moduleGroups![0].children[0], label: "My campaigns" };
  const extra = { ...campaign, href: "/marketing/reports", label: "Reports" };
  const unrelated = { ...input.moduleGroups![0], key: "sales", children: [extra] };
  let calls = 0;
  const result = withSocialMediaNavigation((current) => {
    assert.equal(current, input);
    calls += 1;
    return {
      ...current,
      placement: "tools",
      moduleGroups: [{ ...current.moduleGroups![0], label: "Our marketing", children: [campaign, extra] }, unrelated],
    };
  })(input);
  assert.equal(calls, 1);
  assert.equal(result.placement, "tools");
  assert.equal(result.moduleGroups![0].label, "Our marketing");
  assert.equal(result.moduleGroups![0].children[0].label, "My campaigns");
  assert.equal(result.moduleGroups![0].children[1], extra);
  assert.equal(result.moduleGroups![1], unrelated);
});

test("repeated application preserves customized Social Media without adding duplicates", () => {
  const enhance = withSocialMediaNavigation();
  const first = enhance(registration());
  first.moduleGroups![0].children[1].label = "Our social plan";
  const second = enhance(first);
  assert.deepEqual(second, first);
  assert.equal(second.moduleGroups![0].children.filter((item) => item.href === "/marketing/social-media").length, 1);
  assert.equal(second.moduleGroups![0].children[1].label, "Our social plan");
});

test("does not create a marketing group if a client has removed it", () => {
  const result = withSocialMediaNavigation(() => ({ key: "marketing", moduleGroups: [] }))(registration());
  assert.deepEqual(result.moduleGroups, []);
});

test("preserves explicit access and active-route choices on existing items", () => {
  const base = registration();
  const campaign = { ...base.moduleGroups![0].children[0], activeMatch: { prefixes: ["/marketing/campaigns"] } };
  const social = {
    ...campaign,
    href: "/marketing/social-media",
    label: "Private strategy",
    visibility: "admin" as const,
    activeMatch: { prefixes: ["/marketing/social-media"] },
  };
  const input = { ...base, moduleGroups: [{ ...base.moduleGroups![0], children: [campaign, social] }] };
  const result = withSocialMediaNavigation()(input);
  assert.equal(result.moduleGroups![0].children[0], campaign);
  assert.equal(result.moduleGroups![0].children[1], social);
  assert.equal(result.moduleGroups![0].children.length, 2);
});
