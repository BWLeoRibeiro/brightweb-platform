import type { ReactNode } from "react";
import { DocsSidebar } from "../../components/docs/sidebar";
import { brightwebVersion, docsSections } from "../../lib/docs";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="docs-shell">
      <DocsSidebar sections={docsSections} version={brightwebVersion} />
      <section className="docs-main">
        <div className="docs-main-inner">{children}</div>
      </section>
    </main>
  );
}
