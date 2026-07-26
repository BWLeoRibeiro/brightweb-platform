import { marketingCampaignHandlers } from "../../../_handlers";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export function PUT(request: Request, context: RouteContext) {
  return marketingCampaignHandlers.workflowNodesPut(request, context);
}
