import { marketingCampaignHandlers } from "../_handlers";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return marketingCampaignHandlers.campaignsGet(request);
}

export function POST(request: Request) {
  return marketingCampaignHandlers.campaignsPost(request);
}
