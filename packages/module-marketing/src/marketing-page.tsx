import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { listCampaigns } from "./campaigns";
import { listTopics } from "./server";
import { listSegments } from "./segments";
import { MarketingUiProvider } from "./ui/context";
import { MarketingClient } from "./ui/marketing-client";
import "../tokens.css";

export async function MarketingPage() {
  const { supabase } = await requireServerPageRoleAccess(["staff", "admin"]);
  const [campaigns, topics, segments] = await Promise.all([
    listCampaigns(supabase),
    listTopics(supabase),
    listSegments(supabase),
  ]);

  return (
    <MarketingUiProvider>
      <MarketingClient
        initialCampaigns={campaigns}
        initialTopics={topics}
        initialSegments={segments}
      />
    </MarketingUiProvider>
  );
}
