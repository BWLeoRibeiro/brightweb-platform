import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { listCampaigns } from "./campaigns";
import { listTopics } from "./server";
import { listSegments } from "./segments";
import {
  getCampaignAnalytics,
  getMarketingOverview,
} from "./analytics";
import { MarketingUiProvider } from "./ui/context";
import { MarketingClient } from "./ui/marketing-client";
import "../tokens.css";

export async function MarketingPage() {
  const { supabase } = await requireServerPageRoleAccess(["staff", "admin"]);
  const [campaigns, topics, segments, overview] = await Promise.all([
    listCampaigns(supabase),
    listTopics(supabase),
    listSegments(supabase),
    getMarketingOverview(supabase),
  ]);
  const campaignAnalytics = Object.fromEntries(
    await Promise.all(campaigns.map(async (campaign) => [
      campaign.id,
      await getCampaignAnalytics(supabase, campaign.id),
    ] as const)),
  );

  return (
    <MarketingUiProvider>
      <MarketingClient
        initialCampaigns={campaigns}
        initialTopics={topics}
        initialSegments={segments}
        initialOverview={overview}
        initialCampaignAnalytics={campaignAnalytics}
      />
    </MarketingUiProvider>
  );
}
