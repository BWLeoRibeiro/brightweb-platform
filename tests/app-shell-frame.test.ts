import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShellFrame } from "../packages/app-shell/src/components/app-shell-frame.tsx";

const frameProps = {
  sidebar: h("aside", null, "Sidebar"),
  header: h("span", null, "Header"),
  children: h("p", null, "Content"),
};

test("AppShellFrame mounts the shared toaster by default", () => {
  const html = renderToStaticMarkup(h(AppShellFrame, frameProps));

  assert.match(html, /aria-label="Notifications alt\+T"/);
  assert.equal((html.match(/aria-label="Notifications alt\+T"/g) ?? []).length, 1);
});

test("AppShellFrame supports disabling or replacing the shared toaster", () => {
  const disabled = renderToStaticMarkup(h(AppShellFrame, { ...frameProps, toaster: null }));
  const custom = renderToStaticMarkup(h(AppShellFrame, {
    ...frameProps,
    toaster: h("div", { "data-custom-toaster": true }),
  }));

  assert.doesNotMatch(disabled, /aria-label="Notifications alt\+T"/);
  assert.match(custom, /data-custom-toaster="true"/);
  assert.doesNotMatch(custom, /aria-label="Notifications alt\+T"/);
});

test("the platform preview relies on the shared toaster", () => {
  const previewShell = readFileSync(
    join(process.cwd(), "apps/platform-preview/app/(shell)/shell-layout-client.tsx"),
    "utf8",
  );

  assert.doesNotMatch(previewShell, /<Toaster|import \{ Toaster \}/);
});
