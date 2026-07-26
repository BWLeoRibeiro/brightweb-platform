import { marketingCampaignHandlers } from "../_handlers";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return marketingCampaignHandlers.workflowsGet(request);
}

export function POST(request: Request) {
  return marketingCampaignHandlers.workflowsPost(request);
}
