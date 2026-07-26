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
  getCampaign,
  listCampaignRecipients,
  listCampaigns,
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
  createMarketingServiceClient,
  listTopics,
  resolveByUnsubscribeToken,
  unsubscribeAll,
  unsubscribeTopic,
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
    listCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    listRecipients: listCampaignRecipients,
    scheduleCampaign,
    cancelCampaign,
    sendCampaignNow,
    retryCampaignFailures,
    sendTestEmail,
    runWorker: runMarketingWorker,
    processWebhook: processResendWebhook,
    listSegments,
    getSegment,
    createSegment,
    updateSegment,
    deleteSegment,
    previewSegment,
    getMarketingOverview,
    getCampaignAnalytics,
    getSegmentAnalytics,
  });
}
