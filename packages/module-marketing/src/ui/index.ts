export { createMarketingUiClient } from "./client";
export { MarketingUiProvider, useMarketingUiClient } from "./context";
export { defaultMarketingUiDictionary } from "./dictionary";
export { MarketingClient } from "./marketing-client";
export type { MarketingClientProps } from "./marketing-client";
export type {
  MarketingCampaign,
  MarketingCampaignInput,
  MarketingCampaignRecipient,
  MarketingCampaignStatus,
  MarketingSegment,
  MarketingSegmentInput,
  MarketingSegmentPreview,
  MarketingTopic,
  MarketingUiClient,
  MarketingUiDictionary,
  MarketingUiProviderProps,
} from "./types";
export type { MarketingSegmentRule } from "../segments";
export type {
  MarketingCampaignAnalytics,
  MarketingOverviewMetrics,
  MarketingSegmentAnalytics,
} from "../analytics";
