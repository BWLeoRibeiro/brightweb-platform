import type { MarketingCampaignStatus, MarketingWorkflowStatus } from "./types";

export type MarketingCollectionView = "campaigns" | "segments" | "workflows";
export type MarketingStatusFilter = "all" | MarketingCampaignStatus | MarketingWorkflowStatus;

export const MARKETING_EVENTS = {
  setSearch: "marketing:set-search",
  setStatusFilter: "marketing:set-status-filter",
  create: "marketing:create",
  state: "marketing:state",
} as const;

export type MarketingStateEventDetail = {
  view: MarketingCollectionView | "analytics";
  search: string;
  status: MarketingStatusFilter;
};

export function dispatchMarketingState(detail: MarketingStateEventDetail) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(MARKETING_EVENTS.state, { detail }));
}
