import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createProjectsUiClient } from "../packages/module-projects/src/ui/client.ts";
import { ProjectsUiProvider } from "../packages/module-projects/src/ui/context.tsx";
import { ProjectClientAccessCard } from "../packages/module-projects/src/ui/project-client-access-card.tsx";
import type { ProjectClientAccessMode } from "../packages/module-projects/src/contracts.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
before(() => {
  // Closed sheets schedule body-pointer cleanup. There is no DOM or modal in
  // these renderer tests, so that unrelated browser timer has nothing to clean.
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout() {} } });
});
after(() => {
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

function textContent(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textContent).join(" ");
  if (node && typeof node === "object" && "children" in node) return textContent(node.children);
  return "";
}

const eligibleClients = ["Ana", "Bruno", "Carla", "Diogo", "Eva"].map((label, index) => ({
  profileId: `person-${index}`,
  label,
  email: `${label.toLowerCase()}@example.test`,
  organizationRole: index === 0 ? "admin" : "member",
}));

async function mountCard({ mode = "selected_clients", canManage = true, denied = false }: {
  mode?: ProjectClientAccessMode;
  canManage?: boolean;
  denied?: boolean;
} = {}) {
  const requests: Array<{ path: string; method: string }> = [];
  let rejectRequest = denied;
  const client = createProjectsUiClient("/api/projects", async (path, init) => {
    requests.push({ path: String(path), method: init?.method ?? "GET" });
    return rejectRequest
      ? Response.json({ error: "Acesso indisponível" }, { status: 403 })
      : Response.json({ data: {
        mode,
        organizations: [{
          organizationId: "org-1",
          organizationName: "Organização Alfa",
          isPrimary: true,
          selected: mode !== "hidden",
          eligibleClients,
          selectedProfileIds: eligibleClients.slice(0, 4).map((person) => person.profileId),
        }],
      } });
  });
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(ProjectsUiProvider, { client }, createElement(ProjectClientAccessCard, {
      projectId: "project-1",
      canManage,
      summary: {
        mode,
        organizationNames: ["Organização Alfa"],
        organizationCount: 1,
        selectedClientCount: 4,
        contentReadiness: { hasSummary: true, hasScope: false, hasContact: false, clientVisibleMilestoneCount: 0, sharedDocumentCount: 0 },
      },
    })));
  });
  return {
    renderer: renderer!,
    requests,
    allowRetry() { rejectRequest = false; },
    text() { return textContent(renderer!.toJSON()); },
    button(label: string) {
      const button = renderer!.root.findAllByType("button").find((node) => textContent(node).trim().replace(/\s+/g, " ") === label);
      assert.ok(button, `Missing button: ${label}`);
      return button;
    },
    async unmount() { await act(async () => renderer!.unmount()); },
  };
}

test("access managers see selected member identities and can expand and collapse without changing access", async () => {
  const card = await mountCard();
  try {
    assert.match(card.text(), /Ana.*ana@example.test.*Bruno.*Carla/);
    assert.doesNotMatch(card.text(), /Diogo|Eva/);
    assert.equal(card.button("Gerir acesso").props.disabled, false);
    await act(async () => card.button("Ver todos os membros (4)").props.onClick());
    assert.match(card.text(), /Diogo.*diogo@example.test/);
    assert.doesNotMatch(card.text(), /Eva/);
    await act(async () => card.button("Mostrar menos membros").props.onClick());
    assert.doesNotMatch(card.text(), /Diogo/);
    assert.deepEqual(card.requests, [{ path: "/api/projects/project-1/client-access", method: "GET" }]);
  } finally { await card.unmount(); }
});

test("all-organisation mode previews current members without narrowing its audience", async () => {
  const card = await mountCard({ mode: "all_org_clients" });
  try {
    assert.match(card.text(), /Todos os membros da organização/);
    await act(async () => card.button("Ver todos os membros (5)").props.onClick());
    assert.match(card.text(), /Eva.*eva@example.test/);
    assert.equal(card.requests.length, 1);
  } finally { await card.unmount(); }
});

test("summary-only viewers neither request the member directory nor receive member identities or management controls", async () => {
  const card = await mountCard({ canManage: false });
  try {
    assert.match(card.text(), /Organização Alfa.*4 membros/);
    assert.doesNotMatch(card.text(), /Ana|Bruno|Carla|Diogo|Eva|example.test|Gerir acesso|Ver todos os membros/);
    assert.deepEqual(card.requests, []);
  } finally { await card.unmount(); }
});

test("private projects do not display any member audience", async () => {
  const card = await mountCard({ mode: "hidden" });
  try {
    assert.match(card.text(), /Não partilhado com a organização/);
    assert.doesNotMatch(card.text(), /Ana|Bruno|Carla|Diogo|Eva|example.test|Membros com acesso/);
  } finally { await card.unmount(); }
});

test("failed directory reads keep management disabled and reveal identities only after a successful retry", async () => {
  const card = await mountCard({ denied: true });
  try {
    assert.match(card.text(), /Acesso indisponível/);
    assert.equal(card.button("Gerir acesso").props.disabled, true);
    assert.doesNotMatch(card.text(), /Ana|example.test/);
    card.allowRetry();
    await act(async () => card.button("Tentar novamente").props.onClick());
    assert.match(card.text(), /Ana.*ana@example.test/);
    assert.equal(card.button("Gerir acesso").props.disabled, false);
    assert.equal(card.requests.length, 2);
    assert.ok(card.requests.every((request) => request.method === "GET"));
  } finally { await card.unmount(); }
});
