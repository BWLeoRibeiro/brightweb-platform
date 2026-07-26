import { marketingCampaignHandlers } from "../../../_handlers";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export function GET(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.analyticsSegmentGet(request, context);
}
