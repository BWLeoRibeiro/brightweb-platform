import { createModuleRouteHandler } from "../_shared/create-module-route-handler";

export const dynamic = "force-dynamic";

export const GET = createModuleRouteHandler(
  () => import("@brightweblabs/module-crm"),
  "handleCrmContactsGetRequest",
);

export const POST = createModuleRouteHandler(
  () => import("@brightweblabs/module-crm"),
  "handleCrmContactsPostRequest",
);

export const PATCH = createModuleRouteHandler(
  () => import("@brightweblabs/module-crm"),
  "handleCrmContactsPatchRequest",
);
