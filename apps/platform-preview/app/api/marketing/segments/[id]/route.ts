import { marketingCampaignHandlers } from "../../_handlers";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export function GET(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.segmentGet(request, context);
}

export function PATCH(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.segmentPatch(request, context);
}

export function DELETE(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.segmentDelete(request, context);
}

