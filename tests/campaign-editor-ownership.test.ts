import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { useCampaignEditor } from "../packages/module-marketing/src/ui/use-campaign-editor.ts";
import { defaultMarketingUiDictionary as dictionary } from "../packages/module-marketing/src/ui/dictionary.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function deferred() { let resolve!: (value: any) => void; const promise = new Promise<any>(yes => { resolve = yes; }); return { promise, resolve }; }
const campaign = { id: "a", name: "Campaign", subject: "Original", topicId: "topic", bodyHtml: "Body", status: "draft", totalRecipients: 2 } as any;
async function harness(t: test.TestContext) {
  const replacements: any[] = [];
  let state!: ReturnType<typeof useCampaignEditor>;
  const client: any = { getCampaign: async () => campaign, listRecipients: async () => [], getCampaignAnalytics: async () => null, updateCampaign: async (_id: string, input: any) => ({ ...campaign, ...input }) };
  function Harness({ currentClient = client }: { currentClient?: any }) { state = useCampaignEditor({ client: currentClient, dictionary, ensureSegmentOptions: async () => [], mutations: { replace: value => replacements.push(value), remove() {}, removeRecipient() {}, analytics() {}, overview() {}, refresh() {} } }); return null; }
  let tree: any; await act(async () => { tree = create(React.createElement(Harness)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return { client, state: () => state, replacements, replaceClient: async (currentClient: any) => { await act(async () => tree.update(React.createElement(Harness, { currentClient }))); } };
}
for (const during of ["load", "save"]) test(`campaign preserves edits made while ${during} is pending`, async t => {
  const h = await harness(t); const pending = deferred();
  if (during === "load") h.client.getCampaign = () => pending.promise;
  else { await act(async () => h.state().commands.openCampaign(campaign)); h.client.updateCampaign = () => pending.promise; }
  await act(async () => { void (during === "load" ? h.state().commands.openCampaign(campaign) : h.state().commands.persist()); });
  await act(async () => h.state().draft.setForm(current => ({ ...current, subject: "New typing" })));
  await act(async () => pending.resolve(campaign));
  assert.equal(h.state().draft.form.subject, "New typing");
  assert.equal(h.state().draft.hasUnsavedDraft, true);
  assert.equal(h.state().session.activeCampaign?.subject, "Original");
});
test("duplicate save callbacks dispatch one request and become available after completion", async t => {
  const h = await harness(t); await act(async () => h.state().commands.openCampaign(campaign));
  const pending = deferred(); let calls = 0; h.client.updateCampaign = () => { calls++; return pending.promise; };
  await act(async () => { void h.state().commands.persist(); void h.state().commands.persist(); });
  assert.equal(calls, 1);
  await act(async () => pending.resolve(campaign));
  await act(async () => h.state().commands.persist());
  assert.equal(calls, 2);
});

test("recipient dismissal cannot overlap itself or dispatch and releases after failure", async t => {
  const h = await harness(t); await act(async () => h.state().commands.openCampaign(campaign));
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { confirm: () => true } });
  t.after(() => { if (original) Object.defineProperty(globalThis, "window", original); else delete globalThis.window; });
  let reject!: (error: Error) => void; let deletes = 0; let sends = 0;
  h.client.deleteRecipient = () => { deletes++; return new Promise((_yes, no) => { reject = no; }); };
  h.client.sendCampaign = async () => { sends++; return campaign; };
  await act(async () => {
    void h.state().commands.removeRecipient({ id: "recipient", email: "fixture@example.invalid" } as any);
    void h.state().commands.removeRecipient({ id: "recipient", email: "fixture@example.invalid" } as any);
    void h.state().commands.runAction("send");
  });
  assert.equal(deletes, 1); assert.equal(sends, 0);
  await act(async () => reject(new Error("synthetic failure")));
  assert.equal(h.state().session.busy, null);
  h.client.deleteRecipient = async () => { deletes++; };
  await act(async () => h.state().commands.removeRecipient({ id: "recipient", email: "fixture@example.invalid" } as any));
  assert.equal(deletes, 2);
});

test("replacing the client detaches old save results from the new workspace", async t => {
  const h = await harness(t); await act(async () => h.state().commands.openCampaign(campaign));
  const pending = deferred(); h.client.updateCampaign = () => pending.promise;
  await act(async () => { void h.state().commands.persist(); });
  const before = h.replacements.length;
  await h.replaceClient({ ...h.client });
  await act(async () => pending.resolve({ ...campaign, subject: "Old client response" }));
  assert.equal(h.replacements.length, before);
  assert.equal(h.state().session.editorOpen, false);
  assert.equal(h.state().session.activeCampaign, null);
  assert.equal(h.state().session.busy, null);
});
