import {
  createMarketingCampaignHandlers,
  createNoopEmailSender,
  createResendEmailSender,
  handleMarketingUnsubscribeGetRequest,
  handleMarketingUnsubscribePostRequest,
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

type IdRouteContext = { params: Promise<{ id: string }> };
type NodeRouteContext = { params: Promise<{ id: string; nodeId: string }> };
type TokenRouteContext = { params: Promise<{ token: string }> };

export function marketingUnsubscribeGet(request: Request, context: TokenRouteContext) {
  return handleMarketingUnsubscribeGetRequest(request, context);
}
export function marketingUnsubscribePost(request: Request, context: TokenRouteContext) {
  return handleMarketingUnsubscribePostRequest(request, context);
}
export function marketingAnalyticsOverviewGet(request: Request) {
  return handlers.analyticsOverviewGet(request);
}
export function marketingCampaignsGet(request: Request) {
  return handlers.campaignsGet(request);
}
export function marketingCampaignsPost(request: Request) {
  return handlers.campaignsPost(request);
}
export function marketingSegmentsGet(request: Request) {
  return handlers.segmentsGet(request);
}
export function marketingSegmentsPost(request: Request) {
  return handlers.segmentsPost(request);
}
export function marketingTopicsGet(request: Request) {
  return handlers.topicsGet(request);
}
export function marketingTopicsPost(request: Request) {
  return handlers.topicsPost(request);
}
export function marketingTopicsOrderPost(request: Request) {
  return handlers.topicsOrderPost(request);
}
export function marketingTopicPatch(request: Request, context: IdRouteContext) {
  return handlers.topicPatch(request, context);
}
export function marketingTopicDelete(request: Request, context: IdRouteContext) {
  return handlers.topicDelete(request, context);
}
export function marketingWebhookPost(request: Request) {
  return handlers.webhookPost(request);
}
export function marketingWorkerPost(request: Request) {
  return handlers.workerPost(request);
}
export function marketingWorkflowsGet(request: Request) {
  return handlers.workflowsGet(request);
}
export function marketingWorkflowsPost(request: Request) {
  return handlers.workflowsPost(request);
}
export function marketingAnalyticsCampaignGet(request: Request, context: IdRouteContext) {
  return handlers.analyticsCampaignGet(request, context);
}
export function marketingAnalyticsSegmentGet(request: Request, context: IdRouteContext) {
  return handlers.analyticsSegmentGet(request, context);
}
export function marketingCampaignDelete(request: Request, context: IdRouteContext) {
  return handlers.campaignDelete(request, context);
}
export function marketingCampaignGet(request: Request, context: IdRouteContext) {
  return handlers.campaignGet(request, context);
}
export function marketingCampaignPatch(request: Request, context: IdRouteContext) {
  return handlers.campaignPatch(request, context);
}
export function marketingCampaignCancelPost(request: Request, context: IdRouteContext) {
  return handlers.cancelPost(request, context);
}
export function marketingCampaignRecipientsGet(request: Request, context: IdRouteContext) {
  return handlers.recipientsGet(request, context);
}
export function marketingCampaignRecipientDelete(request: Request, context: { params: Promise<{ id: string; recipientId: string }> }) {
  return handlers.recipientDelete(request, context);
}
export function marketingCampaignRetryPost(request: Request, context: IdRouteContext) {
  return handlers.retryPost(request, context);
}
export function marketingCampaignSchedulePost(request: Request, context: IdRouteContext) {
  return handlers.schedulePost(request, context);
}
export function marketingCampaignSendPost(request: Request, context: IdRouteContext) {
  return handlers.sendPost(request, context);
}
export function marketingCampaignTestPost(request: Request, context: IdRouteContext) {
  return handlers.testPost(request, context);
}
export function marketingSegmentDelete(request: Request, context: IdRouteContext) {
  return handlers.segmentDelete(request, context);
}
export function marketingSegmentGet(request: Request, context: IdRouteContext) {
  return handlers.segmentGet(request, context);
}
export function marketingSegmentPatch(request: Request, context: IdRouteContext) {
  return handlers.segmentPatch(request, context);
}
export function marketingSegmentPreviewByIdPost(request: Request, context: IdRouteContext) {
  return handlers.segmentPreviewPost(request, context);
}
export function marketingSegmentPreviewPost(request: Request) {
  return handlers.segmentPreviewPost(request);
}
export function marketingWorkflowActivatePost(request: Request, context: IdRouteContext) {
  return handlers.workflowActivatePost(request, context);
}
export function marketingWorkflowDelete(request: Request, context: IdRouteContext) {
  return handlers.workflowDelete(request, context);
}
export function marketingWorkflowGet(request: Request, context: IdRouteContext) {
  return handlers.workflowGet(request, context);
}
export function marketingWorkflowNodeDelete(request: Request, context: NodeRouteContext) {
  return handlers.workflowNodeDelete(request, context);
}
export function marketingWorkflowNodesPut(request: Request, context: IdRouteContext) {
  return handlers.workflowNodesPut(request, context);
}
export function marketingWorkflowPatch(request: Request, context: IdRouteContext) {
  return handlers.workflowPatch(request, context);
}
export function marketingWorkflowPausePost(request: Request, context: IdRouteContext) {
  return handlers.workflowPausePost(request, context);
}
export function marketingWorkflowRunsGet(request: Request, context: IdRouteContext) {
  return handlers.workflowRunsGet(request, context);
}
