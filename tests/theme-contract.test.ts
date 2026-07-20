import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const themeRoot = path.join(repoRoot, "packages", "theme");
const sourceRoot = path.join(themeRoot, "src");

async function read(relativePath: string) {
  return fs.readFile(path.join(themeRoot, relativePath), "utf8");
}

function stripComments(css: string) {
  return css.replaceAll(/\/\*[\s\S]*?\*\//g, "").trim();
}

function customProperties(css: string) {
  return new Set(Array.from(css.matchAll(/(--[a-z0-9-]+)\s*:/g), (match) => match[1]));
}

test("theme CSS keeps hex literals in palette files", async () => {
  const files = (await fs.readdir(sourceRoot)).filter((file) => file.endsWith(".css") && file !== "tokens.css");
  for (const file of files) {
    const css = await fs.readFile(path.join(sourceRoot, file), "utf8");
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, `${file} must derive colors from tokens`);
  }
});

test("the base reset contains one complete base layer and no outside rules", async () => {
  const css = stripComments(await read("src/base.css"));
  assert.match(css, /^@layer\s+base\s*\{/);
  assert.match(css, /button,\s*\n\s*input\s*\{\s*font:\s*inherit;/);

  const openingBrace = css.indexOf("{");
  let depth = 0;
  let closingBrace = -1;
  for (let index = openingBrace; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") depth -= 1;
    if (depth === 0) {
      closingBrace = index;
      break;
    }
  }
  assert.equal(closingBrace, css.length - 1, "all reset rules must be inside @layer base");
});

test("every Tailwind color mapping references a defined token", async () => {
  const tokens = customProperties(await read("src/tokens.css"));
  const theme = await read("src/theme.css");
  const mappings = Array.from(theme.matchAll(/--color-[a-z0-9-]+\s*:\s*var\((--[a-z0-9-]+)\)/g));
  assert.ok(mappings.length > 0, "expected color mappings in theme.css");
  for (const [, token] of mappings) {
    assert.ok(tokens.has(token), `${token} is referenced by theme.css but absent from tokens.css`);
  }
});

test("the MQ theme contains only scoped custom-property overrides", async () => {
  const css = stripComments(await read("themes/mq.css"));
  const allowedSelectors = new Set([
    ":root",
    ':root.dark,\n:root[data-theme="dark"],\n.theme-dark',
    ':root.light,\n:root[data-theme="light"],\n.theme-light',
  ]);
  const blocks = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g));
  assert.equal(blocks.length, 3, "MQ compatibility CSS must contain only root/light/dark scopes");
  for (const [, rawSelector, body] of blocks) {
    const selector = rawSelector.trim();
    assert.ok(allowedSelectors.has(selector), `unexpected MQ theme selector: ${selector}`);
    const declarations = body.split(";").map((entry) => entry.trim()).filter(Boolean);
    for (const declaration of declarations) {
      assert.match(declaration, /^--[a-z0-9-]+\s*:/, `${selector} may only set custom properties`);
    }
  }
});
