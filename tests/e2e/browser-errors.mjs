import assert from "node:assert/strict";

// Keep expected failures local to the journey which deliberately triggers them.
export function observeBrowserErrors(page, { appUrl, additionalOrigins = [], expectedResponse = () => false }) {
  const errors = [];
  const diagnostic = message => String(message)
    .replace(/(?:https?|wss?):\/\/[^\s"'<>]+/g, value => { try { const url = new URL(value); return `${url.origin}${url.pathname}`; } catch { return "[redacted URL]"; } })
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted key]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted token]");
  const origins = new Set([appUrl, ...additionalOrigins].map(url => new URL(url).origin));
  page.on("pageerror", error => errors.push(`Uncaught browser error: ${diagnostic(error.message)}`));
  page.on("console", message => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource: the server responded with a status of")) errors.push(`Console error: ${diagnostic(message.text())}`);
  });
  page.on("response", response => {
    if (origins.has(new URL(response.url()).origin) && response.status() >= 400 && !expectedResponse(response)) errors.push(`HTTP ${response.status()}: ${response.request().method()} ${new URL(response.url()).pathname}`);
  });
  page.on("requestfailed", request => {
    // Navigation cancellation is normal when Next changes routes. All other
    // first-party transport failures are actionable.
    if (origins.has(new URL(request.url()).origin) && request.failure()?.errorText !== "net::ERR_ABORTED") errors.push(`Request failed: ${new URL(request.url()).pathname} ${request.failure()?.errorText}`);
  });
  return () => assert.deepEqual(errors, [], "no unexpected browser or first-party transport errors");
}
