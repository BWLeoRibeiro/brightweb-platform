import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import { ErrorPage } from "../packages/app-shell/src/status-pages/error-page.tsx";
import { NotFoundPage } from "../packages/app-shell/src/status-pages/not-found-page.tsx";
import { defaultAppShellStatusPagesDictionary } from "../packages/app-shell/src/status-pages/dictionary.ts";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

test("status pages render the literal MQ Portuguese dictionary", () => {
  const notFoundHtml = renderToStaticMarkup(h(NotFoundPage));
  const errorHtml = renderToStaticMarkup(
    h(ErrorPage, { error: new Error("Preview failure"), reset: () => {} }),
  );

  assert.match(notFoundHtml, /404/);
  assert.match(notFoundHtml, /Página não encontrada/);
  assert.match(notFoundHtml, /A página que tentou abrir não existe ou foi movida\./);
  assert.match(notFoundHtml, /Voltar ao início/);
  assert.match(errorHtml, /Algo correu mal/);
  assert.match(errorHtml, /Ocorreu um erro inesperado ao carregar esta página\./);
  assert.match(errorHtml, /Tentar novamente/);
  assert.equal(defaultAppShellStatusPagesDictionary.locale, "pt-PT");
});

test("not-found frame supports an app logo and configurable back action", () => {
  const html = renderToStaticMarkup(
    h(NotFoundPage, {
      brandLogo: h("span", null, "BrightWeb"),
      footerBackHref: "/dashboard",
      footerBackLabel: "Regressar",
    }),
  );

  assert.match(html, /BrightWeb/);
  assert.match(html, /href="\/dashboard"/);
  assert.match(html, /Regressar/);
});

test("error page preserves reset behavior", async () => {
  const source = await readFile(
    path.join(repoRoot, "packages/app-shell/src/status-pages/error-page.tsx"),
    "utf8",
  );

  assert.match(source, /onClick=\{\(\) => reset\(\)\}/);
});

test("preview status routes are thin app-shell mounts", async () => {
  const notFound = await readFile(
    path.join(repoRoot, "apps/platform-preview/app/not-found.tsx"),
    "utf8",
  );
  const error = await readFile(
    path.join(repoRoot, "apps/platform-preview/app/error.tsx"),
    "utf8",
  );

  assert.equal(
    notFound.trim(),
    'export { NotFoundPage as default } from "@brightweblabs/app-shell";',
  );
  assert.match(error, /^"use client";\s+export \{ ErrorPage as default \} from "@brightweblabs\/app-shell";\s*$/);
});
