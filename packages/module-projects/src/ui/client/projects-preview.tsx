import Link from "next/link";
import { ArrowRight, FolderKanban } from "lucide-react";
import { clientProjectsDictionary } from "./dictionary";

/**
 * Backwards-compatible link surface. Project data intentionally lives only in
 * the dedicated client area and is loaded through `/api/account/projects`.
 */
export function ClientProjectsPreview() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <FolderKanban className="mt-0.5 size-5 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-title">{clientProjectsDictionary.safeUi.myProjects}</h2>
          <p className="mt-1 text-body text-muted-foreground">{clientProjectsDictionary.safeUi.previewDescription}</p>
        </div>
      </div>
      <Link href="/account/projetos" className="mt-4 inline-flex items-center gap-1.5 text-body font-semibold text-primary hover:underline">
        {clientProjectsDictionary.safeUi.openProjects} <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
