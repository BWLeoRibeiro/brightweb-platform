import { createModuleRouteHandler } from "../_shared/create-module-route-handler";

export const dynamic = "force-dynamic";

export const GET = createModuleRouteHandler(
  () => import("@brightweblabs/module-crm"),
  "handleCrmStatsGetRequest",
);
