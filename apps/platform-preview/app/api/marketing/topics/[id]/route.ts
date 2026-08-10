import { marketingCampaignHandlers } from "../../_handlers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export function PATCH(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.topicPatch(request, context);
}

export function DELETE(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.topicDelete(request, context);
}
