import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { listCampaigns } from "./campaigns";
import { listTopics } from "./server";
import { MarketingUiProvider } from "./ui/context";
import { MarketingClient } from "./ui/marketing-client";
import "../tokens.css";

export async function MarketingPage() {
  const { supabase } = await requireServerPageRoleAccess(["staff", "admin"]);
  const [campaigns, topics] = await Promise.all([
    listCampaigns(supabase),
    listTopics(supabase),
  ]);

  return (
    <MarketingUiProvider>
      <MarketingClient initialCampaigns={campaigns} initialTopics={topics} />
    </MarketingUiProvider>
  );
}
