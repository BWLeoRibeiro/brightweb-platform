import type { ReactNode } from "react";
import Link from "next/link";
import { getEnabledStarterModules } from "../../config/modules";

const links = getEnabledStarterModules()
  .filter((moduleConfig) => moduleConfig.playgroundHref)
  .map((moduleConfig) => ({
    href: moduleConfig.playgroundHref!,
    label: moduleConfig.label,
  }));

export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return (
    <main className="shell">
      <div className="frame playground-layout">
        <aside className="panel sidebar">
          <div className="panel-inner stack">
            <div>
              <span className="eyebrow">Sandbox</span>
              <h2 style={{ marginBottom: 8 }}>Module Playground</h2>
              <p className="muted">
                Use these routes to inspect package behavior while editing the shared repo.
              </p>
            </div>
            <nav className="nav-list">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="nav-item">
                  {link.label}
                </Link>
              ))}
              <Link href="/" className="nav-item">
                Back to overview
              </Link>
            </nav>
          </div>
        </aside>
        <section className="stack">{children}</section>
      </div>
    </main>
  );
}
