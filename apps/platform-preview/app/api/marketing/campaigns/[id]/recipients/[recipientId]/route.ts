import { marketingCampaignHandlers } from "../../../../_handlers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; recipientId: string }> };

export function DELETE(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.recipientDelete(request, context);
}
