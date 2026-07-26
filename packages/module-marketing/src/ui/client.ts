import { readPublicError } from "@brightweblabs/infra/robustness";
import type {
  MarketingCampaign,
  MarketingCampaignInput,
  MarketingCampaignRecipient,
  MarketingTopic,
  MarketingUiClient,
} from "./types";

async function readPayload(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      readPublicError(payload, response.statusText || "Marketing request failed.").message,
    );
  }
  return payload;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function unwrap<T>(payload: unknown, key: string): T {
  const record = asRecord(payload);
  return (record[key] ?? record.data ?? payload) as T;
}

function parseCampaign(payload: unknown): MarketingCampaign {
  return unwrap<MarketingCampaign>(payload, "campaign");
}

function parseCampaigns(payload: unknown): MarketingCampaign[] {
  const campaigns = unwrap<unknown[]>(payload, "campaigns");
  return Array.isArray(campaigns) ? campaigns.map(parseCampaign) : [];
}

function parseRecipients(payload: unknown): MarketingCampaignRecipient[] {
  const recipients = unwrap<unknown[]>(payload, "recipients");
  if (!Array.isArray(recipients)) return [];
  return recipients.map((value) => {
    const row = asRecord(value);
    return {
      id: String(row.id ?? ""),
      contactId: typeof row.contactId === "string"
        ? row.contactId
        : typeof row.contact_id === "string" ? row.contact_id : null,
      email: String(row.email ?? ""),
      status: String(row.status ?? "queued") as MarketingCampaignRecipient["status"],
      error: typeof row.error === "string" ? row.error : null,
      sentAt: typeof row.sentAt === "string"
        ? row.sentAt
        : typeof row.sent_at === "string" ? row.sent_at : null,
    };
  });
}

function parseTopics(payload: unknown): MarketingTopic[] {
  const topics = unwrap<MarketingTopic[]>(payload, "topics");
  return Array.isArray(topics) ? topics : [];
}

export function createMarketingUiClient(
  basePath = "/api/marketing",
  fetcher: typeof fetch = fetch,
): MarketingUiClient {
  const root = basePath.replace(/\/$/, "");
  const endpoint = (path: string) => `${root}/${path}`;
  const json = (method: string, body?: unknown): RequestInit => ({
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const campaignAction = async (campaignId: string, action: string, body?: unknown) =>
    parseCampaign(
      await readPayload(
        await fetcher(
          endpoint(`campaigns/${encodeURIComponent(campaignId)}/${action}`),
          json("POST", body),
        ),
      ),
    );

  return {
    async listCampaigns() {
      return parseCampaigns(await readPayload(await fetcher(endpoint("campaigns"))));
    },
    async getCampaign(campaignId) {
      return parseCampaign(
        await readPayload(await fetcher(endpoint(`campaigns/${encodeURIComponent(campaignId)}`))),
      );
    },
    async createCampaign(input: MarketingCampaignInput) {
      return parseCampaign(
        await readPayload(await fetcher(endpoint("campaigns"), json("POST", input))),
      );
    },
    async updateCampaign(campaignId, input) {
      return parseCampaign(
        await readPayload(
          await fetcher(
            endpoint(`campaigns/${encodeURIComponent(campaignId)}`),
            json("PATCH", input),
          ),
        ),
      );
    },
    async deleteCampaign(campaignId) {
      await readPayload(
        await fetcher(
          endpoint(`campaigns/${encodeURIComponent(campaignId)}`),
          json("DELETE"),
        ),
      );
    },
    sendCampaign(campaignId) {
      return campaignAction(campaignId, "send");
    },
    scheduleCampaign(campaignId, scheduledAt) {
      return campaignAction(campaignId, "schedule", { scheduledAt });
    },
    cancelCampaign(campaignId) {
      return campaignAction(campaignId, "cancel");
    },
    retryCampaign(campaignId) {
      return campaignAction(campaignId, "retry");
    },
    async sendTest(campaignId, email) {
      await readPayload(
        await fetcher(
          endpoint(`campaigns/${encodeURIComponent(campaignId)}/test`),
          json("POST", { email }),
        ),
      );
    },
    async listRecipients(campaignId) {
      return parseRecipients(
        await readPayload(
          await fetcher(endpoint(`campaigns/${encodeURIComponent(campaignId)}/recipients`)),
        ),
      );
    },
    async listTopics() {
      return parseTopics(await readPayload(await fetcher(endpoint("topics"))));
    },
  };
}
