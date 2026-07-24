"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import { isShellNavItemActive } from "./config";
import type { ShellNavItemConfig } from "./types";

export type ShellNavStateGroup = {
  key: string;
  items: ReadonlyArray<Pick<ShellNavItemConfig, "href" | "activeMatch">>;
};

export type ShellNavState = {
  isSidebarCollapsed: boolean;
  openGroups: Record<string, boolean>;
};

export type ShellNavStateAction =
  | { type: "toggle-sidebar" }
  | { type: "toggle-group"; key: string }
  | { type: "set-group"; key: string; open: boolean }
  | { type: "sync-pathname"; activeGroupKeys: readonly string[] };

export function getActiveShellNavGroupKeys(
  pathname: string,
  groups: readonly ShellNavStateGroup[],
) {
  return groups
    .filter((group) => group.items.some((item) => isShellNavItemActive(pathname, item)))
    .map((group) => group.key);
}

export function createShellNavState(
  pathname: string,
  groups: readonly ShellNavStateGroup[],
): ShellNavState {
  const activeGroupKeys = new Set(getActiveShellNavGroupKeys(pathname, groups));
  return {
    isSidebarCollapsed: false,
    openGroups: Object.fromEntries(
      groups.map((group) => [group.key, activeGroupKeys.has(group.key)]),
    ),
  };
}

export function shellNavStateReducer(
  state: ShellNavState,
  action: ShellNavStateAction,
): ShellNavState {
  if (action.type === "toggle-sidebar") {
    const isSidebarCollapsed = !state.isSidebarCollapsed;
    return {
      isSidebarCollapsed,
      openGroups: isSidebarCollapsed ? {} : state.openGroups,
    };
  }

  if (action.type === "toggle-group") {
    return {
      isSidebarCollapsed: false,
      openGroups: {
        ...state.openGroups,
        [action.key]: state.isSidebarCollapsed ? true : !state.openGroups[action.key],
      },
    };
  }

  if (action.type === "set-group") {
    return {
      ...state,
      openGroups: { ...state.openGroups, [action.key]: action.open },
    };
  }

  const activeGroupKeys = new Set(action.activeGroupKeys);
  const openGroups = Object.fromEntries(
    Object.keys(state.openGroups)
      .concat(action.activeGroupKeys.filter((key) => !(key in state.openGroups)))
      .map((key) => [key, activeGroupKeys.has(key)]),
  );

  return { ...state, openGroups };
}

export type UseShellNavStateOptions = {
  pathname: string;
  groups: readonly ShellNavStateGroup[];
};

export function useShellNavState({ pathname, groups }: UseShellNavStateOptions) {
  const [state, dispatch] = useReducer(
    shellNavStateReducer,
    undefined,
    () => createShellNavState(pathname, groups),
  );
  const activeGroupKeys = useMemo(
    () => getActiveShellNavGroupKeys(pathname, groups),
    [groups, pathname],
  );
  const activeGroupSignature = activeGroupKeys.join("\u0000");

  useEffect(() => {
    dispatch({ type: "sync-pathname", activeGroupKeys });
  }, [activeGroupSignature, pathname]);

  const isGroupOpen = useCallback(
    (key: string) => state.openGroups[key] ?? false,
    [state.openGroups],
  );
  const toggleSidebar = useCallback(() => dispatch({ type: "toggle-sidebar" }), []);
  const toggleGroup = useCallback(
    (key: string) => dispatch({ type: "toggle-group", key }),
    [],
  );
  const setGroupOpen = useCallback(
    (key: string, open: boolean) => dispatch({ type: "set-group", key, open }),
    [],
  );

  return {
    isSidebarCollapsed: state.isSidebarCollapsed,
    isGroupOpen,
    toggleSidebar,
    toggleGroup,
    setGroupOpen,
  };
}
