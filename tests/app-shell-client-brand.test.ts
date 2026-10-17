import assert from "node:assert/strict";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClientPortalFrame } from "../packages/app-shell/src/components/client-portal-frame.tsx";
import type { ShellBrand } from "../packages/app-shell/src/types.ts";
import { starterShellBrand } from "../packages/create-bw-app/template/base/config/brand.ts";

const mark = { src: "/brand/logo-mark.svg", width: 48, height: 48 };
function brand(name: string): ShellBrand {
  return { href: "/", ariaLabel: `${name} — início`, alt: name, collapsedLogo: mark, lightLogo: mark, darkLogo: mark };
}
function render(value: ShellBrand) {
  return renderToStaticMarkup(h(ClientPortalFrame, {
    brand: value,
    pathname: "/account",
    displayName: "Cliente de prova",
    user: { email: "client@example.invalid" },
    userInitials: "CP",
    onSignOut: async () => {},
    children: h("p", null, "Client work"),
  }));
}

test("client header retains the configured BrightWeb brand", () => {
  const html = render(brand("BrightWeb"));
  assert.match(html, />BrightWeb<\/span>/);
  assert.match(html, /aria-label="BrightWeb — início"/);
});

test("client header renders the app brand consistently with its logo and accessible name", () => {
  const html = render(brand("BeGreen Consulting"));
  assert.match(html, />BeGreen Consulting<\/span>/);
  assert.match(html, /alt="BeGreen Consulting"/);
  assert.match(html, /aria-label="BeGreen Consulting — início"/);
  assert.doesNotMatch(html, />BrightWeb<\/span>/);
});

test("unmodified starter brand configuration supplies the client header name", () => {
  const html = render(starterShellBrand);
  assert.match(html, />Starter Client<\/span>/);
  assert.doesNotMatch(html, />BrightWeb<\/span>/);
});

test("configured client brand names render as escaped text", () => {
  const html = render(brand('Acme <Partners> & "Co"'));
  assert.match(html, />Acme &lt;Partners&gt; &amp; &quot;Co&quot;<\/span>/);
  assert.doesNotMatch(html, /<Partners>/);
});

test("custom branding retains client-only navigation and account links", () => {
  const html = render(brand("BeGreen Consulting"));
  for (const href of ["/account", "/account/projetos", "/account/perfil"]) {
    assert.ok(html.includes(`href="${href}"`));
  }
  assert.match(html, /Portal de membros/);
  assert.match(html, /Client work/);
  assert.doesNotMatch(html, /href="\/(dashboard|crm|marketing)"/);
});
