import { createServiceRoleClient } from "@brightweblabs/infra/server";
import {
  createMarketingUnsubscribeGetHandler,
  createMarketingUnsubscribePostHandler,
} from "./http";
import {
  resolveByUnsubscribeToken,
  unsubscribeAll,
  unsubscribeTopic,
} from "./server";

const marketingDependencies = {
  createServiceClient: createServiceRoleClient,
  resolveToken: resolveByUnsubscribeToken,
  unsubscribeAll,
  unsubscribeTopic,
};

export const handleMarketingUnsubscribeGetRequest =
  createMarketingUnsubscribeGetHandler(marketingDependencies);

export const handleMarketingUnsubscribePostRequest =
  createMarketingUnsubscribePostHandler(marketingDependencies);
