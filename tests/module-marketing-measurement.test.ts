import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { MeasurementScreen } from "../packages/module-marketing/src/social-media/measurement-screen.tsx";
import type { SocialMediaMeasurement } from "../packages/module-marketing/src/social-media/types.ts";

const content: SocialMediaMeasurement = {
  period: "Setembro–dezembro", title: "Avaliar o ciclo", introduction: "Ciclo orgânico, sem anúncios pagos.",
  deliverables: [{ value: "19", label: "publicações nas redes", description: "Calendário editorial" }],
  baseline: { value: "15", label: "seguidores no LinkedIn", date: "3 de setembro de 2026", description: "Referência histórica" },
  signals: [{ title: "Utilidade", question: "O conteúdo é útil?", icon: "engagement", indicators: ["Guardados e partilhas"], interpretation: "Observar dúvidas concretas" }],
  decisions: [{ when: "Após 6 publicações nas redes", title: "Definir a meta", description: "Avaliar resultados antes de decidir", outcome: "Proposta de meta fundamentada nos resultados" }],
  routine: "Responsável por definir",
};

test("measurement keeps its premise and baseline visible without references, and exposes signals and decisions under separate headings", () => {
  const html = renderToStaticMarkup(createElement(MeasurementScreen, { content }));
  for (const text of [content.introduction, content.baseline!.date, ...content.signals[0].indicators, content.decisions[0].when, content.routine]) assert.ok(html.includes(text));
  assert.ok(html.includes('<h3 id="measurement-delivery">'));
  assert.ok(html.includes('<h3 id="measurement-signals">'));
  assert.ok(html.includes('<h3 id="measurement-decisions">'));
  assert.ok(!html.includes("<details"));
  assert.ok(html.includes(content.decisions[0].outcome!));
});

test("choosing a signal updates its explanation and indicators, and the first signal can be restored", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const second = { title: "Contactos", question: "Recebemos contactos?", icon: "conversation", indicators: ["Mensagens", "Reuniões"], interpretation: "Conversas sobre necessidades concretas" };
  let renderer;
  try {
    await act(async () => { renderer = create(createElement(MeasurementScreen, { content: { ...content, signals: [...content.signals, second] } })); });
    const buttons = renderer.root.findAllByType("button");
    const detail = () => renderer.root.findByProps({ id: "measurement-signal-detail" });
    assert.equal(buttons[0].props["aria-pressed"], true);
    await act(async () => buttons[1].props.onClick());
    assert.equal(buttons[0].props["aria-pressed"], false);
    assert.equal(buttons[1].props["aria-pressed"], true);
    assert.deepEqual(detail().findByType("h4").children, [second.question]);
    assert.deepEqual(detail().findAllByType("li").map(item => item.children.join("")), ["Mensagens", "Reuniões"]);
    await act(async () => buttons[0].props.onClick());
    assert.deepEqual(detail().findByType("h4").children, [content.signals[0].question]);
    await act(async () => renderer.update(createElement(MeasurementScreen, { content: { ...content, signals: [] } })));
    assert.equal(renderer.root.findAllByType("button").length, 0);
    assert.equal(renderer.root.findAllByProps({ id: "measurement-signal-detail" }).length, 0);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test("external references use client labels, stay optional, and reject unsafe links", () => {
  const html = renderToStaticMarkup(createElement(MeasurementScreen, { content: { ...content, references: {
    title: "Comparar newsletters", description: "Contexto, não uma meta", note: "Audiência de referência",
    columns: { name: "Newsletter", value: "Leitores", interpretation: "Leitura", source: "Fonte" },
    rows: [
      { name: "Outra marca", value: "100", interpretation: "<script>alert(1)</script>", source: { label: "Fonte externa", href: "javascript:alert(1)" } },
      { name: "Marca segura", context: "Contexto local", value: "200", interpretation: "Referência", source: { label: "Website", href: "https://example.com" } },
    ],
  } } }));
  assert.ok(html.includes("<details"));
  assert.ok(!html.includes("<details open"));
  assert.ok(html.includes("Comparar newsletters"));
  assert.ok(html.includes("Contexto, não uma meta"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes('href="https://example.com/" target="_blank" rel="noopener noreferrer"'));
});

test("a different client's sparse plan has no inherited baseline, count, or channel copy", () => {
  const html = renderToStaticMarkup(createElement(MeasurementScreen, { content: {
    ...content, baseline: undefined, deliverables: [], signals: [], decisions: [], routine: "",
  } }));
  for (const absent of ["LinkedIn", "Quatro aspetos", "measurement-signals", "measurement-delivery", "measurement-decisions", "<details"]) assert.ok(!html.includes(absent), absent);
});

test("optional measurement details omit empty lists and unsupported icon names use a safe fallback", () => {
  const html = renderToStaticMarkup(createElement(MeasurementScreen, { content: {
    ...content, baseline: undefined, decisions: [],
    signals: [{ ...content.signals[0], icon: "toString", indicators: [] }],
  } }));
  assert.ok(html.includes(content.signals[0].question));
  assert.ok(!html.includes("<ul"));
  assert.ok(!html.includes("<ol"));
  assert.ok(!html.includes("O que acompanhamos"));
  assert.ok(html.includes("lucide-users"));
});
