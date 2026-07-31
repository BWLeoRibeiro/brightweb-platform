export { createMarketingUiClient } from "./client";
export { MarketingUiProvider, useMarketingUiClient } from "./context";
export { defaultMarketingUiDictionary } from "./dictionary";
export { MarketingClient } from "./marketing-client";
export { TopicWorkspace } from "./topic-workspace";
export type { MarketingClientProps } from "./marketing-client";
export { WorkflowWorkspace } from "./workflow-workspace";
export type { WorkflowWorkspaceProps } from "./workflow-workspace";
export type {
  MarketingCampaign,
  MarketingCampaignInput,
  MarketingCampaignRecipient,
  MarketingCampaignStatus,
  MarketingSegment,
  MarketingSegmentInput,
  MarketingSegmentPreview,
  MarketingTopic,
  MarketingTopicInput,
  MarketingTopicUpdate,
  MarketingUiClient,
  MarketingUiDictionary,
  MarketingUiProviderProps,
  MarketingWorkflowInput,
  MarketingWorkflowNodeInput,
  MarketingWorkflowNodeType,
  MarketingWorkflowRun,
  MarketingWorkflowStatus,
  MarketingWorkflowTriggerConfig,
  MarketingWorkflowTriggerType,
} from "./types";
export type { MarketingSegmentRule } from "../segments";
export type {
  MarketingCampaignAnalytics,
  MarketingOverviewMetrics,
  MarketingSegmentAnalytics,
} from "../analytics";
