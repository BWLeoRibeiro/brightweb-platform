import { marketingCampaignHandlers } from "../_handlers";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return marketingCampaignHandlers.topicsGet(request);
}
