"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthUi } from "./context";
import type { AuthLayoutVariant } from "./types";

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
    setQueryVariant(value === "split" ? "split" : undefined);
  }, []);
  const resolvedVariant = variant ?? queryVariant ?? layoutVariant ?? "centered";
  const split = resolvedVariant === "split";

  return (
    <main className="auth-layout" data-variant={resolvedVariant}>
      {split ? (
        <aside className="auth-layout__brand-panel">
          <div className="auth-layout__brand-panel-inner">
            <div className="auth-layout__brand-logo auth-layout__brand-logo--inverse">{brand.logo}</div>
            <div className="auth-layout__brand-copy">
              <h2>{brand.splitHeadline ?? dictionary.layout.splitHeadline}</h2>
              <p>{brand.splitDescription ?? dictionary.layout.splitDescription}</p>
            </div>
          </div>
        </aside>
      ) : null}

      <section className="auth-layout__form-side">
        <div className="auth-layout__stack">
          {!split ? <div className="auth-layout__brand-logo">{brand.logo}</div> : null}
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
    <div className={`auth-vessel dark relative w-full max-w-[440px] overflow-hidden rounded-[2.5rem] ${className}`}>
      <div className="auth-vessel__wash" aria-hidden="true" />
      <div className="relative z-10 flex flex-col gap-7 p-9 lg:p-10">{children}</div>
    </div>
  );
}

export function AuthHeading({ title, description, eyebrow }: { title: string; description: string; eyebrow?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h1 className="heading-2 text-foreground">{title}</h1>
      <p className="paragraph-small text-foreground/45">{description}</p>
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

export function AuthNotice({ children, tone = "error", id }: { children: React.ReactNode; tone?: "error" | "success"; id?: string }) {
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`auth-notice auth-notice--${tone} rounded-xl p-3.5`}
    >
      <p className="paragraph-mini">{children}</p>
    </div>
  );
}
