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
  queryCampaigns,
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
  MarketingCampaignListParams,
  MarketingCampaignListResult,
  UpdateCampaignInput,
} from "./campaigns";
export {
  aggregateMarketingMetrics,
  emptyMarketingMetrics,
  getCampaignAnalytics,
  getMarketingOverview,
  getSegmentAnalytics,
  MARKETING_ANALYTICS_EVENT_TYPES,
  MARKETING_RECIPIENT_STATUSES,
} from "./analytics";
export type {
  MarketingCampaignAnalytics,
  MarketingOverviewMetrics,
  MarketingQueueBreakdown,
  MarketingSegmentAnalytics,
} from "./analytics";
export {
  createSegment,
  deleteSegment,
  getSegment,
  listSegments,
  querySegments,
  previewSegment,
  resolveSegmentContacts,
  updateSegment,
} from "./segments";
export type {
  CreateSegmentInput,
  MarketingSegment,
  MarketingSegmentListParams,
  MarketingSegmentListResult,
  MarketingSegmentRule,
  SegmentContact,
  UpdateSegmentInput,
} from "./segments";
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
export {
  activateWorkflow,
  createWorkflow,
  deleteWorkflow,
  deleteWorkflowNode,
  enqueueFormSubmission,
  enqueueWorkflowRunsForTrigger,
  getWorkflow,
  listWorkflowRuns,
  listWorkflows,
  queryWorkflows,
  pauseWorkflow,
  processDueWorkflowRuns,
  scanActivityTriggers,
  updateWorkflow,
  upsertWorkflowNodes,
} from "./workflows";
export type {
  CreateWorkflowInput,
  MarketingWorkflow,
  MarketingWorkflowListParams,
  MarketingWorkflowListResult,
  MarketingWorkflowNode,
  MarketingWorkflowWithNodes,
  UpdateWorkflowInput,
  UpsertWorkflowNodeInput,
  WorkflowNodeType,
  WorkflowStatus,
  WorkflowTriggerType,
} from "./workflows";
export { processResendWebhook } from "./webhooks";
export type { ResendWebhookResult } from "./webhooks";
export {
  createMarketingServiceClient,
  createTopic,
  ensureContactSettings,
  getContactSubscriptions,
  isEmailable,
  isSuppressed,
  listTopics,
  reorderTopics,
  resolveByUnsubscribeToken,
  setSubscription,
  suppress,
  unsubscribeAll,
  unsubscribeTopic,
  updateTopic,
} from "./server";
export type {
  CreateMarketingTopicInput,
  UpdateMarketingTopicInput,
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
  TopicWorkspace,
  WorkflowWorkspace,
  createMarketingUiClient,
  defaultMarketingUiDictionary,
  useMarketingUiClient,
} from './ui';
export type {
  MarketingClientProps,
  MarketingUiClient,
  MarketingUiDictionary,
  MarketingUiProviderProps,
  WorkflowWorkspaceProps,
} from './ui';
export { marketingModuleRegistration } from './registration';
