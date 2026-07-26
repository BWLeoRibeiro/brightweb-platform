export type MarketingEmailMessage = {
  to: string;
  subject: string;
  html?: string | null;
  text?: string | null;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
};

export type MarketingEmailResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

export interface MarketingEmailSender {
  sendOne(message: MarketingEmailMessage): Promise<MarketingEmailResult>;
  sendBatch(messages: MarketingEmailMessage[]): Promise<MarketingEmailResult[]>;
}

export function createNoopEmailSender(
  logger: Pick<Console, "warn"> = console,
): MarketingEmailSender {
  const fail = (message: MarketingEmailMessage): MarketingEmailResult => {
    logger.warn(
      `[marketing] Email delivery is not configured; skipped ${message.to}.`,
    );
    return { ok: false, error: "Email delivery is not configured." };
  };
  return {
    async sendOne(message) {
      return fail(message);
    },
    async sendBatch(messages) {
      return messages.map(fail);
    },
  };
}
