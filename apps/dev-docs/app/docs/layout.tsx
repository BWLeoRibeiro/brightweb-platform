import type { ReactNode } from "react";
import { DocsSidebar } from "../../components/docs/sidebar";
import { docsSections } from "../../lib/docs";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="docs-shell">
      <DocsSidebar sections={docsSections} />
      <section className="docs-main">
        <div className="docs-main-inner">{children}</div>
      </section>
    </main>
  );
}
