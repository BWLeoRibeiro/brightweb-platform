import { Resend } from "resend";
import type {
  MarketingEmailMessage,
  MarketingEmailResult,
  MarketingEmailSender,
} from "./types";

export type ResendEmailSenderConfig = {
  apiKey: string;
  defaultFromEmail: string;
  defaultFromName?: string | null;
  replyTo?: string | null;
};

function fromAddress(message: MarketingEmailMessage, config: ResendEmailSenderConfig) {
  const email = message.fromEmail || config.defaultFromEmail;
  const name = message.fromName || config.defaultFromName;
  return name ? `${name} <${email}>` : email;
}

export function createResendEmailSender(
  config: ResendEmailSenderConfig,
): MarketingEmailSender {
  if (!config.apiKey.trim() || !config.defaultFromEmail.trim()) {
    throw new Error("Resend requires an API key and default sender email.");
  }
  const resend = new Resend(config.apiKey);

  const sendOne = async (
    message: MarketingEmailMessage,
  ): Promise<MarketingEmailResult> => {
    try {
      const response = await resend.emails.send({
        from: fromAddress(message, config),
        to: message.to,
        subject: message.subject,
        ...(message.html
          ? { html: message.html }
          : { text: message.text || "" }),
        replyTo: message.replyTo || config.replyTo || undefined,
        headers: message.headers,
        tags: message.tags,
      });
      if (response.error || !response.data?.id) {
        return {
          ok: false,
          error: response.error?.message || "Resend did not return a message ID.",
        };
      }
      return { ok: true, providerMessageId: response.data.id };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Resend request failed.",
      };
    }
  };

  return {
    sendOne,
    async sendBatch(messages) {
      return Promise.all(messages.map(sendOne));
    },
  };
}
