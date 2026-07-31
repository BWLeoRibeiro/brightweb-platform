import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { createServiceRoleClient } from "@brightweblabs/infra/server";
import { queryCampaigns } from "./campaigns";
import { listTopics } from "./server";
import { querySegments } from "./segments";
import { getMarketingOverview } from "./analytics";
import {
  queryWorkflows,
} from "./workflows";
import { MarketingUiProvider } from "./ui/context";
import { MarketingClient } from "./ui/marketing-client";
import "../tokens.css";
import "../marketing.css";

export async function MarketingPage() {
  // Gate on the caller's session, then read with the service role. Every
  // marketing table is service-role-only: RLS grants no policy to
  // `authenticated`, and marketing_segments additionally revokes the table
  // grant. Reading these with the request-scoped client returned empty lists
  // for campaigns, topics and workflows, and threw
  // "permission denied for table marketing_segments" on segments — so the
  // page 500'd, and would have rendered blank even if it had not.
  await requireServerPageRoleAccess(["staff", "admin"]);
  const supabase = createServiceRoleClient();
  if (!supabase) {
    throw new Error(
      "Marketing requires a Supabase service-role key. Set SUPABASE_SECRET_DEFAULT_KEY for this app.",
    );
  }
  const [campaignPage, topics, segmentPage, overview, workflowPage] = await Promise.all([
    queryCampaigns(supabase, { page: 1, pageSize: 20 }),
    listTopics(supabase),
    querySegments(supabase, { page: 1, pageSize: 20 }),
    getMarketingOverview(supabase),
    queryWorkflows(supabase, { page: 1, pageSize: 20 }),
  ]);
  const campaigns = campaignPage.items;
  const segments = segmentPage.items;
  const workflows = workflowPage.items.map((workflow) => ({
    ...workflow,
    nodes: [],
    nodeCount: 0,
    runCount: 0,
    countsKnown: false,
  }));

  return (
    <MarketingUiProvider>
      <MarketingClient
        initialCampaigns={campaigns}
        initialTopics={topics}
        initialSegments={segments}
        initialWorkflows={workflows}
        initialOverview={overview}
        initialCampaignAnalytics={{}}
        initialCollectionPages={{
          campaigns: { total: campaignPage.total, totalPages: campaignPage.totalPages },
          segments: { total: segmentPage.total, totalPages: segmentPage.totalPages },
          workflows: { total: workflowPage.total, totalPages: workflowPage.totalPages },
        }}
      />
    </MarketingUiProvider>
  );
}
