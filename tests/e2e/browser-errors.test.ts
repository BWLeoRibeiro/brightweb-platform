import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { observeBrowserErrors } from "./browser-errors.mjs";

const appUrl = "http://127.0.0.1:4000";
for (const event of ["pageerror", "console", "response", "requestfailed"]) {
  test(`browser acceptance rejects unexpected ${event}`, () => {
    const page = new EventEmitter();
    const verify = observeBrowserErrors(page, { appUrl });
    const request = { url: () => `${appUrl}/api/save`, method: () => "POST", failure: () => ({ errorText: "net::ERR_CONNECTION_RESET" }) };
    const value = event === "pageerror" ? new Error("hydration failed") : event === "console" ? { type: () => "error", text: () => "render failed" } : event === "response" ? { url: request.url, request: () => request, status: () => 500 } : request;
    page.emit(event, value);
    assert.throws(verify, /no unexpected browser/);
  });
}
test("an explicitly expected response does not mask a different failing request", () => {
  const page = new EventEmitter();
  const verify = observeBrowserErrors(page, { appUrl, expectedResponse: response => response.status() === 403 && response.url() === `${appUrl}/api/denied` });
  const response = (path: string, status: number) => ({ url: () => `${appUrl}${path}`, status: () => status, request: () => ({ method: () => "POST" }) });
  page.emit("response", response("/api/denied", 403));
  verify();
  page.emit("response", response("/api/other", 403));
  assert.throws(verify);
});

test("real backend HTTP errors are observed as first-party failures", () => {
  const page = new EventEmitter();
  const verify = observeBrowserErrors(page, { appUrl, additionalOrigins: ["http://127.0.0.1:5000"] });
  page.emit("response", { url: () => "http://127.0.0.1:5000/rest/v1/projects", status: () => 400, request: () => ({ method: () => "GET" }) });
  assert.throws(verify, /HTTP 400/);
});

test("browser diagnostics retain failure context without auth tokens", () => {
  const page = new EventEmitter();
  const verify = observeBrowserErrors(page, { appUrl });
  page.emit("console", { type: () => "error", text: () => "Connection failed https://example.test/auth/callback?token_hash=private-value sb_secret_example" });
  assert.throws(verify, error => {
    assert.match(error.message, /Connection failed https:\/\/example.test\/auth\/callback/);
    assert.doesNotMatch(error.message, /private-value|sb_secret_example/);
    return true;
  });
});
