import { marketingCampaignHandlers } from "../../_handlers";

export async function POST(request: Request) {
  return marketingCampaignHandlers.topicsOrderPost(request);
}
