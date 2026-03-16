"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocSectionDefinition } from "../../lib/docs";

type DocsSidebarProps = {
  sections: DocSectionDefinition[];
};

export function DocsSidebar({ sections }: DocsSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <nav className="docs-mobile-nav" aria-label="Mobile documentation navigation">
        {sections.flatMap((section) =>
          section.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`docs-mobile-pill ${pathname === link.href ? "active" : ""}`}
            >
              {link.title}
            </Link>
          )),
        )}
      </nav>

      <aside className="docs-sidebar">
        <div className="docs-sidebar-inner">
          <Link href="/docs" className="docs-brand">
            <span className="docs-brand-mark">BW</span>
            <span>
              <strong>BrightWeb Docs</strong>
              <small>Internal platform handbook</small>
            </span>
          </Link>

          <div className="docs-sidebar-intro">
            <span className="eyebrow">Current truth</span>
            <p>
              This app renders the root <code>docs/</code> folder directly. The repo markdown is the source of truth, and
              this UI is only the reading layer over it.
            </p>
          </div>

          <div className="docs-sidebar-sections">
            {sections.map((section) => (
              <section key={section.title} className="docs-sidebar-section">
                <p className="docs-sidebar-label">{section.eyebrow}</p>
                <h2>{section.title}</h2>
                <div className="docs-sidebar-links">
                  {section.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`docs-sidebar-link ${pathname === link.href ? "active" : ""}`}
                    >
                      <span>{link.title}</span>
                      <small>{link.summary}</small>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
