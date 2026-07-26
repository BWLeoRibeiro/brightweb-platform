import { marketingCampaignHandlers } from "../../../../_handlers";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; nodeId: string }>;
};

export function DELETE(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.workflowNodeDelete(request, context);
}
