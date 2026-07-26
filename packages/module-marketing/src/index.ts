export {
  createMarketingCampaignHandlers,
  handleMarketingUnsubscribeGetRequest,
  handleMarketingUnsubscribePostRequest,
} from "./handlers";
export type { MarketingCampaignHandlerConfig } from "./handlers";
export {
  createMarketingCampaignHttpHandlers,
  createMarketingUnsubscribeGetHandler,
  createMarketingUnsubscribePostHandler,
} from "./http";
export type { MarketingCampaignHttpDependencies } from "./http";
export {
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  expandCampaignRecipients,
  getCampaign,
  listCampaignRecipients,
  listCampaigns,
  retryCampaignFailures,
  scheduleCampaign,
  sendCampaignNow,
  sendTestEmail,
  updateCampaign,
} from "./campaigns";
export type {
  CampaignStatus,
  CreateCampaignInput,
  MarketingCampaign,
  UpdateCampaignInput,
} from "./campaigns";
export {
  createNoopEmailSender,
  createResendEmailSender,
} from "./email";
export type {
  MarketingEmailMessage,
  MarketingEmailResult,
  MarketingEmailSender,
  ResendEmailSenderConfig,
} from "./email";
export { runMarketingWorker } from "./worker";
export type {
  MarketingWorkerDependencies,
  MarketingWorkerResult,
} from "./worker";
export { processResendWebhook } from "./webhooks";
export type { ResendWebhookResult } from "./webhooks";
export {
  createMarketingServiceClient,
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
export { MarketingPage } from './marketing-page';
export {
  MarketingClient,
  MarketingUiProvider,
  createMarketingUiClient,
  defaultMarketingUiDictionary,
  useMarketingUiClient,
} from './ui';
export type {
  MarketingClientProps,
  MarketingUiClient,
  MarketingUiDictionary,
  MarketingUiProviderProps,
} from './ui';
export { marketingModuleRegistration } from './registration';
