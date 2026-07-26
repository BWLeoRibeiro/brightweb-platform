import { marketingCampaignHandlers } from "../../../_handlers";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export function POST(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.segmentPreviewPost(request, context);
}

