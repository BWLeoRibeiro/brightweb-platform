import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StrategyScreen } from "../packages/module-marketing/src/social-media/strategy-screens.tsx";

test("semantic copy preserves inline emphasis and spaces while escaping markup", () => {
  const plan = {
    title: "Library", period: "2027", sections: [], types: {}, events: [],
    campaigns: { eyebrow: "Campaigns", title: "Reading", introduction: "An annual programme", items: [
      { period: "Spring", title: "Read together", description: [{ text: "One", emphasis: true }, { text: " idea <script>alert(1)</script>" }], points: [] },
    ] },
  };
  const html = renderToStaticMarkup(createElement(StrategyScreen, { id: "campanhas", plan }));
  assert.ok(html.includes("<b>One</b> idea &lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<ul>"));
});
