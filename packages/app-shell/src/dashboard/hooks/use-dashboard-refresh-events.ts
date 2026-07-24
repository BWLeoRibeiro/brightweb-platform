import { useEffect } from "react";
import { DASHBOARD_EVENTS, dispatchDashboardCustomEvent, dispatchDashboardEvent, type DashboardRefreshEventDetail } from "../events";

export function useDashboardRefreshEvents({ isRefreshing, onRefresh }: { isRefreshing: boolean; onRefresh: (detail?: DashboardRefreshEventDetail) => void }) {
  useEffect(() => {
    const handleRefresh = (event: Event) => onRefresh((event as CustomEvent<DashboardRefreshEventDetail>).detail);
    window.addEventListener(DASHBOARD_EVENTS.refresh, handleRefresh);
    return () => window.removeEventListener(DASHBOARD_EVENTS.refresh, handleRefresh);
  }, [onRefresh]);

  useEffect(() => {
    dispatchDashboardCustomEvent(DASHBOARD_EVENTS.state, { isLoading: isRefreshing });
    if (!isRefreshing) dispatchDashboardEvent(DASHBOARD_EVENTS.refreshComplete);
  }, [isRefreshing]);
}
