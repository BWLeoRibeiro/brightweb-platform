"use client";

import { Button } from "@brightweblabs/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Tag } from "lucide-react";
import { useMemo } from "react";
import type { DocSectionDefinition } from "../../lib/docs";

type DocsSidebarProps = {
  sections: DocSectionDefinition[];
  version: string;
};

export function DocsSidebar({ sections, version }: DocsSidebarProps) {
  const pathname = usePathname();
  const activeSectionKey = useMemo(() => {
    return (
      sections.find((section) => pathname === section.href || pathname.startsWith(`${section.href}/`))?.key ??
      sections.find((section) => section.key === "foundations")?.key ??
      sections[0]?.key
    );
  }, [pathname, sections]);

  return (
    <>
      <nav className="docs-mobile-nav" aria-label="Mobile documentation navigation">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className={`docs-mobile-pill ${pathname === section.href || pathname.startsWith(`${section.href}/`) ? "active" : ""}`}
          >
            {section.title}
          </Link>
        ))}
      </nav>

      <aside className="docs-sidebar">
        <div className="docs-sidebar-inner">
          <Link href="/docs" className="docs-brand">
            <span className="docs-brand-mark">BW</span>
            <span>
              <strong>BrightWeb Docs</strong>
              <small>Stack handbook</small>
            </span>
          </Link>

          <div className="docs-sidebar-meta">
            <div className="docs-sidebar-meta-card">
              <span className="docs-sidebar-meta-icon">
                <Tag size={16} aria-hidden="true" />
              </span>
              <div>
                <strong>Latest version</strong>
                <small>{version}</small>
              </div>
            </div>
          </div>

          <div className="docs-sidebar-sections">
            {sections.map((section) => {
              const sectionActive = pathname === section.href || pathname.startsWith(`${section.href}/`);
              const sectionOpen = activeSectionKey === section.key;

              return (
                <section key={section.key} className="docs-sidebar-section">
                  <div className={`docs-sidebar-section-header ${sectionActive ? "active" : ""} ${sectionOpen ? "open" : ""}`}>
                    <Button asChild variant="ghost" className="docs-sidebar-section-button">
                      <Link href={section.href}>
                        <span className="docs-sidebar-section-trigger-copy">
                          <span className="docs-sidebar-section-title">{section.title}</span>
                        </span>
                        <ChevronRight
                          size={16}
                          aria-hidden="true"
                          className={sectionOpen ? "docs-sidebar-section-trigger-icon open" : "docs-sidebar-section-trigger-icon"}
                        />
                      </Link>
                    </Button>
                  </div>

                  {section.links.length > 0 && sectionOpen ? (
                    <div className="docs-sidebar-section-content">
                      <div className="docs-sidebar-links">
                        {section.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className={`docs-sidebar-link ${pathname === link.href ? "active" : ""}`}
                          >
                            {link.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
