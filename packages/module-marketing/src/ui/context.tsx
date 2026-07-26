"use client";

import { createContext, useContext, useMemo } from "react";
import { createMarketingUiClient } from "./client";
import type { MarketingUiClient, MarketingUiProviderProps } from "./types";

const MarketingUiContext = createContext<MarketingUiClient | null>(null);
const defaultClient = createMarketingUiClient();

export function MarketingUiProvider({ children, client }: MarketingUiProviderProps) {
  const value = useMemo(() => client ?? defaultClient, [client]);
  return <MarketingUiContext.Provider value={value}>{children}</MarketingUiContext.Provider>;
}

export function useMarketingUiClient() {
  return useContext(MarketingUiContext) ?? defaultClient;
}
