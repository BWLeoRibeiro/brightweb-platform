import {
  createMarketingCampaignHttpHandlers,
  createMarketingUnsubscribeGetHandler,
  createMarketingUnsubscribePostHandler,
} from "./http";
import { requireServerUserAccess } from "@brightweblabs/core-auth/server";
import {
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  deleteCampaignRecipient,
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
import {
  createSegment,
  deleteSegment,
  getSegment,
  listSegments,
  querySegments,
  previewSegment,
  updateSegment,
} from "./segments";
import type { MarketingEmailSender } from "./email/types";
import { runMarketingWorker } from "./worker";
import { processResendWebhook } from "./webhooks";
import {
  getCampaignAnalytics,
  getMarketingOverview,
  getSegmentAnalytics,
} from "./analytics";
import {
  activateWorkflow,
  createWorkflow,
  deleteWorkflow,
  deleteWorkflowNode,
  getWorkflow,
  listWorkflowRuns,
  listWorkflows,
  queryWorkflows,
  pauseWorkflow,
  updateWorkflow,
  upsertWorkflowNodes,
} from "./workflows";
import {
  createTopic,
  deleteTopic,
  createMarketingServiceClient,
  listTopics,
  reorderTopics,
  resolveByUnsubscribeToken,
  unsubscribeAll,
  unsubscribeTopic,
  updateTopic,
} from "./server";

const marketingDependencies = {
  createServiceClient: createMarketingServiceClient,
  resolveToken: resolveByUnsubscribeToken,
  unsubscribeAll,
  unsubscribeTopic,
};

export const handleMarketingUnsubscribeGetRequest =
  createMarketingUnsubscribeGetHandler(marketingDependencies);

export const handleMarketingUnsubscribePostRequest =
  createMarketingUnsubscribePostHandler(marketingDependencies);

export type MarketingCampaignHandlerConfig = {
  sender: MarketingEmailSender;
  workerSecret: string;
  webhookSecret: string;
  publicAppUrl?: string | null;
  logger?: Pick<Console, "error">;
};

export function createMarketingCampaignHandlers(
  config: MarketingCampaignHandlerConfig,
) {
  return createMarketingCampaignHttpHandlers({
    getAccess: requireServerUserAccess,
    createServiceClient: createMarketingServiceClient,
    sender: config.sender,
    workerSecret: config.workerSecret,
    webhookSecret: config.webhookSecret,
    publicAppUrl: config.publicAppUrl,
    logger: config.logger,
    listTopics,
    reorderTopics,
    createTopic,
    deleteTopic,
    updateTopic,
    listCampaigns,
    queryCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    deleteRecipient: deleteCampaignRecipient,
    listRecipients: listCampaignRecipients,
    scheduleCampaign,
    cancelCampaign,
    sendCampaignNow,
    retryCampaignFailures,
    sendTestEmail,
    runWorker: runMarketingWorker,
    processWebhook: processResendWebhook,
    listSegments,
    querySegments,
    getSegment,
    createSegment,
    updateSegment,
    deleteSegment,
    previewSegment,
    getMarketingOverview,
    getCampaignAnalytics,
    getSegmentAnalytics,
    listWorkflows,
    queryWorkflows,
    getWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    activateWorkflow,
    pauseWorkflow,
    upsertWorkflowNodes,
    deleteWorkflowNode,
    listWorkflowRuns,
  });
}
