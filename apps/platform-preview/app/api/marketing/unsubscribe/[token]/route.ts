export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { handleMarketingUnsubscribeGetRequest } =
    await import("@brightweblabs/module-marketing");
  return handleMarketingUnsubscribeGetRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  const { handleMarketingUnsubscribePostRequest } =
    await import("@brightweblabs/module-marketing");
  return handleMarketingUnsubscribePostRequest(request, context);
}
