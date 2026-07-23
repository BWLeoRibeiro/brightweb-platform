import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { defaultAuthUiDictionary } from "../packages/core-auth/src/ui/dictionary.ts";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const authRoot = path.join(repoRoot, "packages", "core-auth");

async function read(relativePath: string) {
  return readFile(path.join(authRoot, relativePath), "utf8");
}

test("auth UI has a substantial PT-only dictionary contract", () => {
  const leaves = (value: unknown): number =>
    typeof value === "string" || typeof value === "function"
      ? 1
      : value && typeof value === "object"
        ? Object.values(value).reduce((sum, item) => sum + leaves(item), 0)
        : 0;
  assert.equal(defaultAuthUiDictionary.locale, "pt-PT");
  assert.ok(leaves(defaultAuthUiDictionary) >= 90);
  assert.equal(defaultAuthUiDictionary.postLogin.preparing, "A preparar o seu portal…");
});

test("auth UI components use the injectable client boundary", async () => {
  const componentFiles = [
    "src/ui/login-page.tsx",
    "src/ui/forgot-password-page.tsx",
    "src/ui/reset-password-page.tsx",
    "src/ui/invite-page.tsx",
    "src/ui/post-login-page.tsx",
  ];
  for (const file of componentFiles) {
    const source = await read(file);
    assert.doesNotMatch(source, /@supabase|@brightweblabs\/infra/, `${file} must not access Supabase directly`);
  }
  const types = await read("src/ui/types.ts");
  for (const method of ["signInWithPassword", "sendMagicLink", "requestReset", "resetPassword", "registerInvite"]) {
    assert.match(types, new RegExp(`${method}\\(`));
  }
});

test("post-login preserves guarded role routing and delayed shimmer", async () => {
  const source = await read("src/ui/post-login-page.tsx");
  assert.ok(source.includes('value.startsWith("//")'));
  assert.ok(source.includes('["/dashboard", "/crm", "/projetos", "/ferramentas"]'));
  assert.match(source, /setTimeout\(\(\) => setShowSkeleton\(true\), 400\)/);
  assert.match(source, /resolvePostLoginPath\(access\.role\)/);
});

test("auth tokens have neutral defaults and MQ overrides", async () => {
  const defaults = await read("tokens.css");
  const mq = await readFile(path.join(repoRoot, "packages", "theme", "themes", "mq.css"), "utf8");
  const tokens = Array.from(defaults.matchAll(/(--auth-[a-z0-9-]+)\s*:/g), (match) => match[1]);
  assert.ok(tokens.length >= 18);
  for (const token of tokens) assert.match(mq, new RegExp(`${token.replaceAll("-", "\\-")}\\s*:`));
});

test("preview auth routes are thin package mounts", async () => {
  const routes = [
    "login/page.tsx",
    "forgot-password/page.tsx",
    "reset-password/page.tsx",
    "invite/[invitationId]/page.tsx",
    "auth/confirmed/page.tsx",
    "auth/post-login/page.tsx",
  ];
  for (const route of routes) {
    const source = await readFile(path.join(repoRoot, "apps", "platform-preview", "app", "(auth)", route), "utf8");
    assert.match(source, /@brightweblabs\/core-auth\/ui/);
  }
});

test("auth primary CTAs use the shared default Button color contract", async () => {
  const files = [
    "src/ui/login-page.tsx",
    "src/ui/forgot-password-page.tsx",
    "src/ui/reset-password-page.tsx",
    "src/ui/invite-page.tsx",
  ];
  for (const file of files) {
    const source = await read(file);
    assert.doesNotMatch(
      source,
      /<Button[^>]*className="[^"]*(?:bg-primary|text-primary-foreground|hover:bg-primary)[^"]*"/,
      `${file} must not restyle primary CTA colors outside the default Button variant`,
    );
  }
});
