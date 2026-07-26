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

export const marketingCampaignHandlers = createMarketingCampaignHandlers({
  sender,
  workerSecret: process.env.MARKETING_WORKER_SECRET ?? "",
  webhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? "",
  publicAppUrl:
    process.env.PUBLIC_APP_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? "http://localhost:3000",
});
