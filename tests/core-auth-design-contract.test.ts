import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const authRoot = path.join(repoRoot, "packages", "core-auth");

async function read(relativePath: string) {
  return readFile(path.join(authRoot, relativePath), "utf8");
}

test("auth layout geometry is package-owned and does not require host Tailwind scanning", async () => {
  const layout = await read("src/ui/auth-layout.tsx");
  const tokens = await read("tokens.css");

  assert.match(layout, /className="auth-vessel__body"/);
  assert.doesNotMatch(layout, /\bp-9\b|\blg:p-10\b|\bmax-w-\[440px\]\b|\bgap-7\b/);

  for (const selector of [
    "auth-vessel__body",
    "auth-heading",
    "auth-divider",
    "auth-form",
    "auth-field-label",
    "auth-primary-action",
    "auth-support-action",
    "auth-footnote",
  ]) {
    assert.match(tokens, new RegExp(`\\.${selector.replaceAll("-", "\\-")}\\s*(?:,|\\{)`));
  }
});

test("auth typography and spacing roles form a readable, responsive contract", async () => {
  const tokens = await read("tokens.css");

  assert.match(tokens, /--text-auth-heading:\s*clamp\(2rem,\s*5vw,\s*2\.5rem\)/);
  assert.match(tokens, /--text-auth-copy:\s*1rem/);
  assert.match(tokens, /--text-auth-label:\s*0\.875rem/);
  assert.match(tokens, /--text-auth-support:\s*0\.875rem/);
  assert.match(tokens, /--text-auth-meta:\s*0\.8125rem/);
  assert.match(tokens, /--space-auth-card-padding:\s*clamp\(1\.5rem,\s*4vw,\s*2\.5rem\)/);
  assert.match(tokens, /--color-auth-copy-muted:\s*var\(--foreground-muted-accessible\)/);
  assert.doesNotMatch(tokens, /\.auth-heading \.paragraph-small\s*\{[^}]*opacity:/s);
});

test("auth routes use package-owned composition classes for critical spacing", async () => {
  const routeFiles = [
    "src/ui/login-page.tsx",
    "src/ui/forgot-password-page.tsx",
    "src/ui/reset-password-page.tsx",
    "src/ui/invite-page.tsx",
    "src/ui/confirmed-page.tsx",
  ];

  for (const file of routeFiles) {
    const source = await read(file);
    assert.doesNotMatch(
      source,
      /\b(?:flex-col|gap-5|mb-1\.5|text-foreground\/(?:45|60)|h-11|rounded-full)\b/,
      `${file} must not rely on host-generated utility CSS for auth geometry or readable text`,
    );
  }
});
