import type { ReactNode } from "react";
import { DocsSidebar } from "../../components/docs/sidebar";
import { docsSections } from "../../lib/docs";
import { getBrightwebVersion } from "../../lib/version";

export default async function DocsLayout({ children }: { children: ReactNode }) {
  const version = await getBrightwebVersion();

  return (
    <main className="docs-shell">
      <DocsSidebar sections={docsSections} version={version} />
      <section className="docs-main">
        <div className="docs-main-inner">{children}</div>
      </section>
    </main>
  );
}
