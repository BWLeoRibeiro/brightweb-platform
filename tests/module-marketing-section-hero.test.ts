import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StrategyScreen } from "../packages/module-marketing/src/social-media/strategy-screens.tsx";

// A second client's cadence must not inherit BeGreen's weekly/Insight model.
const basePlan = { title: "Library", period: "2027", sections: [], types: {}, events: [] };
const editorial = {
  eyebrow: "Publication approach", title: "Two stories each quarter.", titleAccent: "One annual report.",
  introduction: "A plan for a community library.",
};

test("editorial hero renders the client headline and accent with one heading", () => {
  const html = renderToStaticMarkup(createElement(StrategyScreen, { id: "plano", plan: { ...basePlan, editorial } }));
  const header = html.match(/<header[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? "";
  assert.equal((header.match(/<h2\b/g) ?? []).length, 1);
  assert.ok(header.includes("Two stories each quarter.<br/><span>One annual report.</span>"));
  assert.ok(header.includes(editorial.introduction));
  for (const leaked of ["BeGreen", "Insight", "PPWR", "Um tema, quatro", "Até dezembro"]) assert.ok(!html.includes(leaked));
  assert.equal((html.match(/<section\b/g) ?? []).length, 1, "missing optional editorial sections leave no empty headings");
});

test("campaign hero and optional launch use only supplied client content", () => {
  const campaigns = { eyebrow: "Campaigns", title: "Spring reading", introduction: "An annual reading programme.", items: [] };
  const html = renderToStaticMarkup(createElement(StrategyScreen, { id: "campanhas", plan: { ...basePlan, campaigns } }));
  assert.ok(html.includes("Spring reading"));
  assert.ok(html.includes(campaigns.introduction));
  assert.ok(!html.includes("Lançamento"));
  assert.ok(!html.includes("Insight"));
  assert.ok(!html.includes("<br"));
});

test("missing screen content does not render a client-specific fallback", () => {
  const html = renderToStaticMarkup(createElement(StrategyScreen, { id: "metricas", plan: basePlan }));
  assert.ok(!html.includes("<h2"));
  assert.ok(!html.includes("LinkedIn"));
  assert.ok(!html.includes("dezembro"));
});
