import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { listCampaigns } from "./campaigns";
import { listTopics } from "./server";
import { listSegments } from "./segments";
import {
  getCampaignAnalytics,
  getMarketingOverview,
} from "./analytics";
import {
  getWorkflow,
  listWorkflowRuns,
  listWorkflows,
} from "./workflows";
import { MarketingUiProvider } from "./ui/context";
import { MarketingClient } from "./ui/marketing-client";
import "../tokens.css";
import "../marketing.css";

export async function MarketingPage() {
  const { supabase } = await requireServerPageRoleAccess(["staff", "admin"]);
  const [campaigns, topics, segments, overview, workflowRows] = await Promise.all([
    listCampaigns(supabase),
    listTopics(supabase),
    listSegments(supabase),
    getMarketingOverview(supabase),
    listWorkflows(supabase),
  ]);
  const [campaignAnalytics, workflows] = await Promise.all([
    Promise.all(campaigns.map(async (campaign) => [
      campaign.id,
      await getCampaignAnalytics(supabase, campaign.id),
    ] as const)).then(Object.fromEntries),
    Promise.all(workflowRows.map(async (workflow) => {
      const [detail, runs] = await Promise.all([
        getWorkflow(supabase, workflow.id),
        listWorkflowRuns(supabase, workflow.id),
      ]);
      const nodes = detail?.nodes ?? [];
      return {
        ...workflow,
        nodes: nodes.map((node) => ({
          id: node.id,
          workflowId: node.workflowId,
          type: node.nodeType,
          position: node.position,
          config: node.config,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
        })),
        nodeCount: nodes.length,
        runCount: runs.length,
      };
    })),
  ]);

  return (
    <MarketingUiProvider>
      <MarketingClient
        initialCampaigns={campaigns}
        initialTopics={topics}
        initialSegments={segments}
        initialWorkflows={workflows}
        initialOverview={overview}
        initialCampaignAnalytics={campaignAnalytics}
      />
    </MarketingUiProvider>
  );
}
