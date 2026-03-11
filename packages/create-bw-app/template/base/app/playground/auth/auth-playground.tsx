"use client";

import { useMemo, useState } from "react";
import {
  AUTH_RESEND_COOLDOWN_SECONDS,
  buildResetPasswordRedirectUrl,
  buildSignupCallbackUrl,
  useCooldownTimer,
  validateEmail,
  validatePassword,
} from "@brightweblabs/core-auth/client";

export function AuthPlayground() {
  const [email, setEmail] = useState("hello@brightweblabs.pt");
  const [password, setPassword] = useState("Brightweb2026");
  const passwordResult = useMemo(() => validatePassword(password), [password]);
  const emailIsValid = useMemo(() => validateEmail(email), [email]);
  const cooldown = useCooldownTimer(AUTH_RESEND_COOLDOWN_SECONDS);
  const authUrls = useMemo(() => {
    try {
      return {
        signupCallbackUrl: buildSignupCallbackUrl(),
        resetPasswordUrl: buildResetPasswordRedirectUrl(),
        error: null,
      };
    } catch (error) {
      return {
        signupCallbackUrl: null,
        resetPasswordUrl: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }, []);

  return (
    <>
      <article className="panel">
        <div className="panel-inner">
          <p className="eyebrow">Core Auth</p>
          <h1>Auth package playground</h1>
          <p className="muted">
            This page exercises the external `@brightweblabs/core-auth` client package directly.
          </p>
        </div>
      </article>

      <article className="panel">
        <div className="panel-inner form-grid">
          <div className="field">
            <label htmlFor="email">Email validator</label>
            <input id="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>

          <p className={`status ${emailIsValid ? "ok" : "error"}`}>
            {emailIsValid ? "Valid email" : "Invalid email"}
          </p>

          <div className="field">
            <label htmlFor="password">Password validator</label>
            <input id="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>

          <div className="result-box">
            <strong>{passwordResult.isValid ? "Password accepted" : "Password rejected"}</strong>
            <ul>
              {passwordResult.errors.length === 0 ? <li>No validation errors.</li> : null}
              {passwordResult.errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="panel-inner stack">
          <div>
            <h2>Derived URLs</h2>
            <p className="muted">These values come from the auth package and depend on `NEXT_PUBLIC_APP_URL`.</p>
          </div>
          <div className="code-box">
            {authUrls.error ? (
              <div>
                <strong>Configuration required:</strong> {authUrls.error}
              </div>
            ) : (
              <>
                <div><strong>Signup callback:</strong> {authUrls.signupCallbackUrl}</div>
                <div><strong>Reset password:</strong> {authUrls.resetPasswordUrl}</div>
              </>
            )}
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="panel-inner stack">
          <div>
            <h2>Cooldown hook</h2>
            <p className="muted">Useful for resend-email and rate-limited auth actions.</p>
          </div>
          <div className="actions">
            <button className="action" onClick={() => cooldown.start()} disabled={cooldown.isCoolingDown}>
              {cooldown.isCoolingDown ? `Cooling down: ${cooldown.remaining}s` : "Start cooldown"}
            </button>
            <button className="action secondary" onClick={() => cooldown.reset()}>
              Reset
            </button>
          </div>
        </div>
      </article>
    </>
  );
}
