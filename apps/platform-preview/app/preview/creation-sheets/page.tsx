"use client";

import { useState } from "react";
import { CrmContactDialog, CrmOrganizationSheet } from "@brightweblabs/module-crm/ui";
import { CreateProjectSheet, ProjectsUiProvider } from "@brightweblabs/module-projects/ui";
import { Button } from "@brightweblabs/ui";

type PreviewSheet = "contact" | "organization" | "project" | null;

export default function CreationSheetsPreviewPage() {
  const [sheet, setSheet] = useState<PreviewSheet>("contact");

  return (
    <ProjectsUiProvider>
      <main className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-[48rem]">
          <p className="text-label text-muted-foreground">BrightWeb Platform · Creation sheets</p>
          <h1 className="mt-2 text-title text-foreground">Semantic section previews</h1>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" onClick={() => setSheet("contact")}>Novo contacto</Button>
            <Button type="button" variant="outline" onClick={() => setSheet("organization")}>Nova organização</Button>
            <Button type="button" variant="outline" onClick={() => setSheet("project")}>Novo projeto</Button>
          </div>
        </div>

        <CrmContactDialog
          open={sheet === "contact"}
          organizations={[{ id: "brightweb", name: "BrightWeb Labs" }]}
          owners={[{ id: "leonel", label: "Leonel Ribeiro", email: "leonel@example.com", role: "admin" }]}
          onOpenChange={(open) => { if (!open) setSheet(null); }}
          onSubmit={() => undefined}
        />

        <CrmOrganizationSheet
          open={sheet === "organization"}
          onOpenChange={(open) => { if (!open) setSheet(null); }}
          onSubmit={() => undefined}
        />

        {sheet === "project" ? (
          <CreateProjectSheet
            initialOpen
            organizations={[{ id: "brightweb", name: "BrightWeb Labs" }]}
          />
        ) : null}
      </main>
    </ProjectsUiProvider>
  );
}
