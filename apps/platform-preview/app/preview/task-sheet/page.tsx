"use client";

import { ProjectTaskCreateSheet, ProjectsUiProvider } from "@brightweblabs/module-projects/ui";

export default function TaskSheetPreviewPage() {
  return (
    <ProjectsUiProvider>
      <main className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-[48rem]">
          <p className="text-label text-muted-foreground">BrightWeb Platform · Projects</p>
          <h1 className="mt-2 text-title text-foreground">Task sheet visual preview</h1>
        </div>
        <ProjectTaskCreateSheet
          projectId="preview-project"
          initialOpen
          milestones={[
            { id: "discovery", title: "Descoberta e requisitos" },
            { id: "delivery", title: "Entrega da primeira versão" },
          ]}
          members={[
            { profileId: "leonel", label: "Leonel Ribeiro" },
            { profileId: "maria", label: "Maria Santos" },
          ]}
        />
      </main>
    </ProjectsUiProvider>
  );
}
