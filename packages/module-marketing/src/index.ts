export {
  handleMarketingUnsubscribeGetRequest,
  handleMarketingUnsubscribePostRequest,
} from "./handlers";
export {
  createMarketingUnsubscribeGetHandler,
  createMarketingUnsubscribePostHandler,
} from "./http";
export {
  ensureContactSettings,
  getContactSubscriptions,
  isEmailable,
  isSuppressed,
  listTopics,
  resolveByUnsubscribeToken,
  setSubscription,
  suppress,
  unsubscribeAll,
  unsubscribeTopic,
} from "./server";
export type {
  ConsentSource,
  ContactSubscriptionState,
  MarketingContactSettings,
  MarketingSubscription,
  MarketingTopic,
  ResolvedUnsubscribeContact,
  SubscriptionStatus,
  SuppressionReason,
} from "./types";
