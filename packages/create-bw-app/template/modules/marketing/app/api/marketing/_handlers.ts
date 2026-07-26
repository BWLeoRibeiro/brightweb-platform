import {
  createMarketingCampaignHandlers,
  createNoopEmailSender,
  createResendEmailSender,
} from "@brightweblabs/module-marketing";

const apiKey = process.env.RESEND_API_KEY ?? "";
const defaultFromEmail =
  process.env.MARKETING_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? "";
const defaultFromName =
  process.env.MARKETING_FROM_NAME ?? process.env.RESEND_FROM_NAME ?? "BrightWeb";

const sender = apiKey && defaultFromEmail
  ? createResendEmailSender({
    apiKey,
    defaultFromEmail,
    defaultFromName,
  })
  : createNoopEmailSender();

const handlers = createMarketingCampaignHandlers({
  sender,
  workerSecret: process.env.MARKETING_WORKER_SECRET ?? "",
  webhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? "",
  publicAppUrl:
    process.env.PUBLIC_APP_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? "http://localhost:3000",
});

export const {
  analyticsCampaignGet: marketingAnalyticsCampaignGet,
  analyticsOverviewGet: marketingAnalyticsOverviewGet,
  analyticsSegmentGet: marketingAnalyticsSegmentGet,
  campaignDelete: marketingCampaignDelete,
  campaignGet: marketingCampaignGet,
  campaignPatch: marketingCampaignPatch,
  campaignsGet: marketingCampaignsGet,
  campaignsPost: marketingCampaignsPost,
  cancelPost: marketingCampaignCancelPost,
  recipientsGet: marketingCampaignRecipientsGet,
  retryPost: marketingCampaignRetryPost,
  schedulePost: marketingCampaignSchedulePost,
  sendPost: marketingCampaignSendPost,
  segmentDelete: marketingSegmentDelete,
  segmentGet: marketingSegmentGet,
  segmentPatch: marketingSegmentPatch,
  segmentPreviewPost: marketingSegmentPreviewPost,
  segmentsGet: marketingSegmentsGet,
  segmentsPost: marketingSegmentsPost,
  testPost: marketingCampaignTestPost,
  topicsGet: marketingTopicsGet,
  webhookPost: marketingWebhookPost,
  workerPost: marketingWorkerPost,
  workflowActivatePost: marketingWorkflowActivatePost,
  workflowDelete: marketingWorkflowDelete,
  workflowGet: marketingWorkflowGet,
  workflowNodeDelete: marketingWorkflowNodeDelete,
  workflowNodesPut: marketingWorkflowNodesPut,
  workflowPatch: marketingWorkflowPatch,
  workflowPausePost: marketingWorkflowPausePost,
  workflowRunsGet: marketingWorkflowRunsGet,
  workflowsGet: marketingWorkflowsGet,
  workflowsPost: marketingWorkflowsPost,
} = handlers;
