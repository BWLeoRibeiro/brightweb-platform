"use client";

import { useState } from "react";
import { AppDashboard, PillTabs, type DashboardDataClient } from "@brightweblabs/app-shell";
import { createMarketingUiClient, MarketingClient, MarketingUiProvider, type MarketingClientProps } from "@brightweblabs/module-marketing/ui";
import { getStarterShellConfig } from "../../../config/shell";
import { dashboardDataClient, dashboardInitialData } from "../../(shell)/dashboard/mock-data";

const generatedAt = "2026-08-04T09:30:00.000Z";

const emptyDashboardInitial = {
  projects: {
    generatedAt,
    kpis: { projectsActive: 0, projectsAtRisk: 0, projectsOverdue: 0, projectsDueNext7Days: 0, projectsWithoutOwner: 0, projectBlockedTasks: 0 },
    projects: { overdue: [] },
  },
  crm: {
    generatedAt,
    kpis: { crmTotalContacts: 0, crmNewLast7Days: 0, crmNewLast30Days: 0, crmNewLastYear: 0, crmUnassignedContacts: 0 },
    crm: { statusBreakdown: { lead: 0, qualified: 0, proposal: 0, won: 0, lost: 0 }, recentChanges: [], recentContacts: [] },
  },
  tasks: {
    generatedAt,
    kpis: { total: 0, dueThisWeek: 0, overdue: 0, blocked: 0 },
    tasks: [],
    attention: { total: 0, tasks: [] },
    pagination: { page: 1, pageSize: 50, hasMore: false },
  },
};

const campaigns: MarketingClientProps["initialCampaigns"] = [
  {
    id: "campaign-august",
    name: "Resumo de impacto · agosto",
    subject: "O que a comunidade tornou possível este mês",
    preheader: "Projetos, resultados e próximos passos.",
    bodyHtml: "<p>Olá {{firstName}},</p><p>Veja o impacto deste mês.</p>",
    bodyText: null,
    fromName: "Be Green",
    fromEmail: "comunidade@begreen.pt",
    topicId: "impact",
    segmentId: "active-community",
    status: "sent",
    scheduledAt: null,
    sentAt: "2026-08-01T10:00:00.000Z",
    totalRecipients: 1842,
    sentCount: 1811,
    failedCount: 31,
    createdAt: "2026-07-28T14:20:00.000Z",
    updatedAt: generatedAt,
  },
  {
    id: "campaign-volunteers",
    name: "Voluntariado no Parque Verde",
    subject: "Junte-se a nós no próximo sábado",
    preheader: null,
    bodyHtml: "<p>Temos um lugar para si.</p>",
    bodyText: null,
    fromName: "Be Green",
    fromEmail: "comunidade@begreen.pt",
    topicId: "events",
    segmentId: null,
    status: "scheduled",
    scheduledAt: "2026-08-08T08:00:00.000Z",
    sentAt: null,
    totalRecipients: 624,
    sentCount: 0,
    failedCount: 0,
    createdAt: "2026-08-02T11:10:00.000Z",
    updatedAt: generatedAt,
  },
  {
    id: "campaign-partners",
    name: "Atualização para parceiros",
    subject: "Resultados do segundo trimestre",
    preheader: null,
    bodyHtml: "<p>Partilhamos os resultados mais recentes.</p>",
    bodyText: null,
    fromName: "Be Green",
    fromEmail: "parceiros@begreen.pt",
    topicId: "partners",
    segmentId: "partners",
    status: "draft",
    scheduledAt: null,
    sentAt: null,
    totalRecipients: 0,
    sentCount: 0,
    failedCount: 0,
    createdAt: "2026-08-03T16:45:00.000Z",
    updatedAt: generatedAt,
  },
];

const topics: MarketingClientProps["initialTopics"] = [
  { id: "impact", slug: "impacto", label: "Impacto", description: null, isActive: true, position: 0, createdAt: generatedAt, updatedAt: generatedAt },
  { id: "events", slug: "eventos", label: "Eventos", description: null, isActive: true, position: 1, createdAt: generatedAt, updatedAt: generatedAt },
  { id: "partners", slug: "parceiros", label: "Parceiros", description: null, isActive: true, position: 2, createdAt: generatedAt, updatedAt: generatedAt },
];

const overview: MarketingClientProps["initialOverview"] = {
  sent: 1811,
  delivered: 1774,
  opened: 982,
  clicked: 341,
  unsubscribed: 9,
  bounced: 28,
  complained: 0,
  openRate: 55.4,
  clickRate: 19.2,
  bounceRate: 1.5,
  unsubRate: 0.5,
  complaintRate: 0,
  rawEventTotals: { sent: 1811, delivered: 1774, opened: 982, clicked: 341, unsubscribed: 9, bounced: 28, complained: 0 },
};

function createPreviewMarketingClient(items: MarketingClientProps["initialCampaigns"]) {
  return createMarketingUiClient("/api/preview-marketing", async (input) => {
    const url = new URL(String(input), "http://preview.local");
    const path = url.pathname.replace("/api/preview-marketing/", "");
    if (path === "campaigns") {
      return Response.json({ items, page: 1, pageSize: 20, total: items.length, totalPages: 1 });
    }
    if (path === "segments") {
      return Response.json({ items: [], page: 1, pageSize: 100, total: 0, totalPages: 1 });
    }
    return Response.json({});
  });
}

const previewMarketingClient = createPreviewMarketingClient(campaigns);
const emptyPreviewMarketingClient = createPreviewMarketingClient([]);
const loadingMarketingClient = createMarketingUiClient("/api/preview-marketing", () => new Promise<Response>(() => {}));
const failedMarketingClient = createMarketingUiClient("/api/preview-marketing", async () => Response.json(
  { error: { code: "PREVIEW_UNAVAILABLE", message: "Campanhas temporariamente indisponíveis." } },
  { status: 503 },
));

const loadingDashboardClient: DashboardDataClient = {
  getOverview: () => new Promise(() => {}),
  getProjects: () => new Promise(() => {}),
  getCrm: () => new Promise(() => {}),
  getTasks: () => new Promise(() => {}),
};

const partialErrorDashboardClient: DashboardDataClient = {
  ...dashboardDataClient,
  getCrm: async () => { throw new Error("CRM indisponível."); },
};

type PreviewState = "ready" | "empty" | "loading" | "partial-error";

export function WorkspacePreview() {
  const [surface, setSurface] = useState<"dashboard" | "marketing">("dashboard");
  const [previewState, setPreviewState] = useState<PreviewState>("ready");
  const { dashboardContributions } = getStarterShellConfig();
  const marketingItems = previewState === "ready" ? campaigns : [];
  const marketingClient = previewState === "loading"
    ? loadingMarketingClient
    : previewState === "partial-error"
      ? failedMarketingClient
      : previewState === "empty"
        ? emptyPreviewMarketingClient
        : previewMarketingClient;
  const dashboardClient = previewState === "loading" ? loadingDashboardClient : previewState === "partial-error" ? partialErrorDashboardClient : dashboardDataClient;
  const dashboardInitial = previewState === "ready"
    ? dashboardInitialData
    : previewState === "empty"
      ? emptyDashboardInitial
      : previewState === "partial-error"
        ? { ...dashboardInitialData, crm: null }
        : undefined;

  return (
    <main className="workspace-preview">
      <header className="workspace-preview-controls">
        <div>
          <p className="eyebrow text-label">Visual QA</p>
          <h1 className="text-heading-2">Shared workspaces</h1>
        </div>
        <div className="workspace-preview-actions">
          <PillTabs
            ariaLabel="Workspace"
            items={[{ value: "dashboard", label: "Dashboard" }, { value: "marketing", label: "Campanhas" }]}
            value={surface}
            onValueChange={setSurface}
          />
          <PillTabs
            ariaLabel="Estado"
            items={[
              { value: "ready", label: "Com dados" },
              { value: "empty", label: "Vazio" },
              { value: "loading", label: "A carregar" },
              { value: "partial-error", label: "Erro parcial" },
            ]}
            value={previewState}
            onValueChange={setPreviewState}
          />
        </div>
      </header>

      <section className="workspace-preview-stage">
        {surface === "dashboard" ? (
          <AppDashboard
            key={`dashboard-${previewState}`}
            client={dashboardClient}
            contributions={dashboardContributions}
            initialData={dashboardInitial}
            viewerFirstName="Leonel"
          />
        ) : (
          <MarketingUiProvider client={marketingClient}>
            <MarketingClient
              key={`marketing-${previewState}`}
              initialCampaigns={marketingItems}
              initialTopics={topics}
              initialSegments={[]}
              initialWorkflows={[]}
              initialOverview={overview}
              initialCampaignAnalytics={{}}
              initialCollectionPages={{
                campaigns: { total: marketingItems.length, totalPages: 1 },
                segments: { total: 0, totalPages: 1 },
                workflows: { total: 0, totalPages: 1 },
              }}
              initialCollectionsLoaded={previewState === "ready" || previewState === "empty"}
            />
          </MarketingUiProvider>
        )}
      </section>
    </main>
  );
}
