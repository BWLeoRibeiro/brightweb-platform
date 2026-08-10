"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@brightweblabs/ui";
import { useAuthUi } from "./context";
import type { AuthLayoutVariant } from "./types";
// Owns the .auth-layout* rules used below. Until this import existed, tokens.css
// reached the browser only via account-page.tsx, so every auth screen rendered
// unstyled unless a session happened to load /account first.
import "../../tokens.css";

export function AuthLayout({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: AuthLayoutVariant;
}) {
  const { brand, dictionary, layoutVariant } = useAuthUi();
  const [queryVariant, setQueryVariant] = useState<AuthLayoutVariant | undefined>();
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("variant");
    setQueryVariant(value === "split" || value === "centered" ? value : undefined);
  }, []);
  const resolvedVariant = variant ?? queryVariant ?? layoutVariant ?? "centered";
  const split = resolvedVariant === "split";

  return (
    <main className="auth-layout" data-variant={resolvedVariant}>
      <a className="auth-skip-link" href="#auth-main-content">
        {dictionary.common.skipToContent}
      </a>
      <section id="auth-main-content" className="auth-layout__form-side" tabIndex={-1}>
        <div className="auth-layout__stack">
          <div className={`auth-layout__brand-logo ${split ? "auth-layout__brand-logo--mobile" : ""}`}>{brand.logo}</div>
          {children}
          <footer className="auth-layout__footer">
            <span>{dictionary.layout.footer(brand.companyName)}</span>
            {brand.helpHref ? (
              <>
                <span aria-hidden="true">·</span>
                <Link href={brand.helpHref}>{dictionary.common.help}</Link>
              </>
            ) : null}
          </footer>
        </div>
      </section>

      {split ? (
        <aside className="auth-layout__brand-panel">
          <div className="auth-layout__brand-panel-inner">
            <div className="auth-layout__brand-logo auth-layout__brand-logo--inverse">{brand.logo}</div>
            <div className="auth-layout__brand-copy">
              <h2 className="text-heading-1">{brand.splitHeadline ?? dictionary.layout.splitHeadline}</h2>
              <p className="text-body-lg">{brand.splitDescription ?? dictionary.layout.splitDescription}</p>
            </div>
          </div>
        </aside>
      ) : null}
    </main>
  );
}

export function AuthCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card asChild variant="elevated">
      <div className={`auth-vessel relative w-full max-w-[440px] overflow-hidden ${className}`}>
        <div className="auth-vessel__wash" aria-hidden="true" />
        <div className="auth-vessel__content">{children}</div>
      </div>
    </Card>
  );
}

export function AuthHeading({ title, description, eyebrow }: { title: string; description: string; eyebrow?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h1 className="text-heading-1 auth-heading text-foreground">{title}</h1>
      <p className="text-body auth-paragraph-small text-foreground-muted-accessible">{description}</p>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="auth-divider-line" />
      <span className="auth-divider-dot" />
      <span className="auth-divider-line" />
    </div>
  );
}

export function AuthStepIndicator({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <div className="auth-step" aria-label={`${current} / ${total}: ${label}`}>
      <span className="auth-step__count" aria-hidden="true">{current} / {total}</span>
      <span className="auth-step__label">{label}</span>
    </div>
  );
}

export function AuthStateMark({ tone = "neutral" }: { tone?: "neutral" | "success" | "warning" | "error" }) {
  return <span className={`auth-state-mark auth-state-mark--${tone}`} aria-hidden="true"><span /></span>;
}

export function AuthLoadingState({ label }: { label: string }) {
  return (
    <div className="auth-loading-state" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <span className="auth-loading-state__eyebrow" aria-hidden="true" />
      <span className="auth-loading-state__heading" aria-hidden="true" />
      <span className="auth-loading-state__copy" aria-hidden="true" />
      <span className="auth-loading-state__copy auth-loading-state__copy--short" aria-hidden="true" />
      <span className="auth-loading-state__action" aria-hidden="true" />
    </div>
  );
}

export function AuthNotice({
  children,
  tone = "error",
  id,
}: {
  children: React.ReactNode;
  tone?: "error" | "success" | "warning" | "info";
  id?: string;
}) {
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`auth-notice auth-notice--${tone}`}
    >
      <div className="text-meta auth-paragraph-mini">{children}</div>
    </div>
  );
}
