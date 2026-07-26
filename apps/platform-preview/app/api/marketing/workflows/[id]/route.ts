import { marketingCampaignHandlers } from "../../_handlers";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export function GET(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.workflowGet(request, context);
}

export function PATCH(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.workflowPatch(request, context);
}

export function DELETE(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.workflowDelete(request, context);
}
