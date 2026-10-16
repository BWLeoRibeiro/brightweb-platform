import assert from "node:assert/strict";
import { observeBrowserErrors } from "./browser-errors.mjs";

// Runs against a served production build. The caller supplies its own session;
// the generated-app runner uses a local stateful fixture, not real Supabase/RLS.
export async function runCriticalWorkflowsBrowser({ appUrl, additionalOrigins = [], cookies, marketingPath = "/marketing", topicLabel = "Novidades", setupContext = async () => {} }) {
  const { chromium, expect } = await import("playwright/test");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, url: appUrl })));
    await setupContext(context);
    const page = await context.newPage();
    let deniedResponses = 0;
    const assertNoErrors = observeBrowserErrors(page, { appUrl, additionalOrigins, expectedResponse(response) {
      if (response.status() === 403 && response.request().method() === "POST" && new URL(response.url()).pathname === "/api/marketing/campaigns" && deniedResponses === 0) { deniedResponses++; return true; }
      return false;
    } });
    await page.goto(`${appUrl}${marketingPath}`);
    await page.getByRole("button", { name: "Nova campanha", exact: true }).click();
    const editor = page.getByRole("dialog");
    const name = `Browser regression ${Date.now()}`;
    await editor.getByLabel("Nome interno", { exact: true }).fill(name);
    await editor.getByLabel("Assunto", { exact: true }).fill("Persisted browser subject");
    await editor.getByLabel("Tópico", { exact: true }).click();
    await page.getByRole("option", { name: topicLabel, exact: true }).click();
    await editor.getByLabel("Corpo do email", { exact: true }).fill("Browser draft body");
    let denialInjected = false;
    const denyOnce = async route => {
      if (route.request().method() !== "POST" || denialInjected) return route.continue();
      denialInjected = true;
      await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: { code: "ACCESS_DENIED", message: "Browser test: save denied" } }) });
    };
    await page.route("**/api/marketing/campaigns", denyOnce);
    await editor.getByRole("button", { name: "Guardar rascunho", exact: true }).click();
    await expect(page.getByText("Browser test: save denied", { exact: true })).toBeVisible();
    await expect(editor.getByLabel("Nome interno", { exact: true })).toHaveValue(name);
    await expect(editor.getByRole("button", { name: "Guardar rascunho", exact: true })).toBeEnabled();
    const saved = page.waitForResponse(response => new URL(response.url()).pathname === "/api/marketing/campaigns" && response.request().method() === "POST" && response.status() === 201);
    await editor.getByRole("button", { name: "Guardar rascunho", exact: true }).click();
    const created = await (await saved).json();
    assert.ok(created.id, "retry creates a persisted campaign");
    await page.reload();
    await page.getByRole("button").filter({ has: page.getByText(name, { exact: true }) }).click();
    await expect(editor.getByLabel("Assunto", { exact: true })).toHaveValue("Persisted browser subject");
    await editor.getByLabel("Assunto", { exact: true }).fill("Updated through real controls");
    const updated = page.waitForResponse(response => new URL(response.url()).pathname === `/api/marketing/campaigns/${created.id}` && response.request().method() === "PATCH" && response.status() === 200);
    await editor.getByRole("button", { name: "Guardar rascunho", exact: true }).click();
    await updated;
    await page.reload();
    await page.getByRole("button").filter({ has: page.getByText(name, { exact: true }) }).click();
    await expect(editor.getByLabel("Assunto", { exact: true })).toHaveValue("Updated through real controls");
    assert.equal(deniedResponses, 1, "the rejection path actually ran");
    assertNoErrors();
    console.log("[smoke] Critical browser campaign journey passed: denied save preserves draft, retry, persisted reload and update");
  } finally { await browser.close(); }
}

export async function runLoginAndTaskBrowser({ appUrl, additionalOrigins = [], cookies = [], credentials, projectId, projectName, taskId, taskTitle, projectsPath = "/projetos", setupContext = async () => {} }) {
  const callback = await fetch(`${appUrl}/auth/callback`, { redirect: "manual", signal: AbortSignal.timeout(5000) });
  assert.ok(callback.status >= 300 && callback.status < 400 && callback.headers.get("location"), "callback must redirect");
  assert.equal(new URL(callback.headers.get("location"), appUrl).origin, new URL(appUrl).origin, "callback redirect must preserve the browser cookie origin");
  const { chromium, expect } = await import("playwright/test");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await setupContext(context);
    if (cookies.length) await context.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, url: appUrl })));
    const page = await context.newPage();
    const assertNoErrors = observeBrowserErrors(page, { appUrl, additionalOrigins });
    if (credentials) {
      const anonymousPage = await page.goto(`${appUrl}${projectsPath}/${projectId}`);
      const anonymousHtml = await anonymousPage.text();
      assert.ok(!anonymousHtml.includes(taskTitle) && (!projectName || !anonymousHtml.includes(projectName)), "anonymous HTML must not include seeded project content");
      await expect(page).toHaveURL(url => url.pathname === "/login");
      await expect(page.getByTitle(taskTitle, { exact: true })).toHaveCount(0);
      if (projectName) await expect(page.getByText(projectName, { exact: true })).toHaveCount(0);
      await page.goto(`${appUrl}/login`);
      await page.locator('input[name="email"]').fill(credentials.email);
      await page.locator('input[name="password"]').fill(credentials.password);
      await page.getByRole("button", { name: "Iniciar Sessão", exact: true }).click();
      await page.waitForURL(url => url.pathname === "/dashboard");
      await page.locator('a[href="/projetos"]').first().waitFor({ state: "visible" });
    }
    await page.goto(`${appUrl}${projectsPath}/${projectId}`);
    await page.getByRole("button").filter({ has: page.getByTitle(taskTitle, { exact: true }) }).click();
    const editor = page.getByRole("dialog");
    await editor.getByRole("button", { name: "Editar tarefa", exact: true }).click();
    const title = `${taskTitle} verified`;
    await editor.getByLabel("Título", { exact: true }).fill(title);
    const saved = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/${projectId}/tasks/${taskId}`) && response.request().method() === "PATCH");
    await editor.getByRole("button", { name: "Guardar", exact: true }).click();
    assert.equal((await saved).status(), 200, "task edit persists through the actual app API");
    await expect(editor).toBeHidden();
    await expect(page.getByRole("button").filter({ has: page.getByTitle(title, { exact: true }) })).toBeVisible();
    // Wait for the server-refreshed collection to display the saved value
    // before testing a separate hard reload.
    await page.reload();
    await expect(page.getByRole("button").filter({ has: page.getByTitle(title, { exact: true }) })).toBeVisible();
    await expect(page.getByRole("button").filter({ has: page.getByTitle(taskTitle, { exact: true }) })).toHaveCount(0);
    assertNoErrors();
    console.log(`[smoke] Critical ${credentials ? "login and " : ""}task browser journey passed: open, edit, save and reload`);
    return await context.cookies(appUrl);
  } finally { await browser.close(); }
}

export async function runWorkflowBrowser({ appUrl, additionalOrigins = [], cookies, topicId, marketingPath = "/marketing", setupContext = async () => {} }) {
  const { chromium, expect } = await import("playwright/test");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await setupContext(context);
    await context.addCookies(cookies.map(({ name, value }) => ({ name, value, url: appUrl })));
    const page = await context.newPage();
    const assertNoErrors = observeBrowserErrors(page, { appUrl, additionalOrigins });
    const selectWorkflows = async () => page.getByRole("button", { name: "Automações", exact: true }).click();
    await page.goto(`${appUrl}${marketingPath}`);
    await selectWorkflows();
    await page.getByRole("button", { name: "Nova automação", exact: true }).click();
    const editor = page.getByRole("dialog");
    const name = `Workflow browser ${Date.now()}`;
    await editor.getByLabel("Nome", { exact: true }).fill(name);
    await editor.getByLabel("Tópico da subscrição", { exact: true }).fill(topicId);
    await editor.getByRole("combobox", { name: "Adicionar passo", exact: true }).click();
    await page.getByRole("option", { name: "Adicionar etiqueta", exact: true }).click();
    for (const tag of ["first-regression-tag", "second-regression-tag"]) {
      await editor.getByRole("button", { name: "Adicionar passo", exact: true }).click();
      await editor.getByLabel("Etiqueta", { exact: true }).last().fill(tag);
    }
    await editor.getByRole("button", { name: "Mover para cima", exact: true }).nth(1).click();
    await expect(editor.getByLabel("Etiqueta", { exact: true }).first()).toHaveValue("second-regression-tag");
    const nodesSaved = page.waitForResponse(response => /\/api\/marketing\/workflows\/[^/]+\/nodes$/.test(new URL(response.url()).pathname) && response.request().method() !== "GET");
    await editor.getByRole("button", { name: "Guardar automação", exact: true }).click();
    assert.equal((await nodesSaved).status(), 200, "ordered nodes saved through the transaction endpoint");
    await page.reload();
    await selectWorkflows();
    await page.getByRole("button").filter({ has: page.getByText(name, { exact: true }) }).click();
    await expect(editor.getByLabel("Etiqueta", { exact: true })).toHaveCount(2);
    await expect(editor.getByLabel("Etiqueta", { exact: true }).first()).toHaveValue("second-regression-tag");
    await expect(editor.getByLabel("Etiqueta", { exact: true }).last()).toHaveValue("first-regression-tag");
    await editor.getByRole("button", { name: "Ativar", exact: true }).click();
    await expect(editor.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
    await page.reload();
    await selectWorkflows();
    await page.getByRole("button").filter({ has: page.getByText(name, { exact: true }) }).click();
    await editor.getByRole("button", { name: "Pausar", exact: true }).click();
    await expect(editor.getByRole("button", { name: "Ativar", exact: true })).toBeVisible();
    await page.reload();
    await selectWorkflows();
    await expect(page.getByRole("button").filter({ has: page.getByText(name, { exact: true }) })).toContainText("Em pausa");
    assertNoErrors();
    console.log("[consumer] Workflow browser passed: real controls, reordered persisted nodes, activate, reload and pause");
  } finally { await browser.close(); }
}

export async function runInvitationBrowser({ appUrl, additionalOrigins = [], cookies, invitation, invitedUser, setupContext = async () => {} }) {
  const { chromium, expect } = await import("playwright/test");
  const browser = await chromium.launch();
  try {
    const wrongUser = await browser.newContext();
    await setupContext(wrongUser);
    await wrongUser.addCookies(cookies.map(({ name, value }) => ({ name, value, url: appUrl })));
    const denied = await wrongUser.request.post(`${appUrl}/api/invitations/${invitation.invitationId}/accept?kind=admin`);
    assert.equal(denied.status(), 409, "a different authenticated account cannot accept the invitation");
    assert.equal((await denied.json()).error.code, "INVITATION_EMAIL_MISMATCH");
    const pending = await invitation.state();
    assert.equal(pending.status, "pending");
    assert.equal(pending.role, "client", "denial cannot promote the invited account");
    const context = await browser.newContext();
    await setupContext(context);
    const page = await context.newPage();
    const assertNoErrors = observeBrowserErrors(page, { appUrl, additionalOrigins });
    const responses = [];
    page.on("response", response => responses.push(`${response.status()} ${new URL(response.url()).origin}${new URL(response.url()).pathname}`));
    try {
      const accepted = page.waitForResponse(response => new URL(response.url()).pathname === `/api/invitations/${invitation.invitationId}/accept` && response.request().method() === "POST");
      await page.goto(invitation.acceptanceUrl);
      assert.equal((await accepted).status(), 200, "real GoTrue callback and post-login component accept the invitation");
    } catch {
      assertNoErrors();
      // Playwright navigation errors can contain the token-bearing URL.
      throw new Error(`Invitation callback did not complete at ${new URL(page.url()).origin}${new URL(page.url()).pathname}; cookie names: ${(await context.cookies()).map(cookie => cookie.name).join(",")}; response paths: ${responses.join(", ")}`);
    }
    await expect.poll(async () => (await invitation.state()).status).toBe("accepted");
    await page.waitForURL(url => !url.pathname.startsWith("/auth/") && url.pathname !== "/login");
    const state = await invitation.state();
    assert.equal(state.acceptedByProfileId, invitedUser.profileId);
    assert.equal(state.role, "staff");
    // Retry through the real HTTP boundary is safe and retains the same actor.
    const replay = await context.request.post(`${appUrl}/api/invitations/${invitation.invitationId}/accept?kind=admin`);
    assert.equal(replay.status(), 200);
    assert.deepEqual(await invitation.state(), state);
    assertNoErrors();
    console.log("[consumer] Invitation passed: different-user denial, real auth callback acceptance, assigned role and idempotent retry (no external email)");
  } finally { await browser.close(); }
}
