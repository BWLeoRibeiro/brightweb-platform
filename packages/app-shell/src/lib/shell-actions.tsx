"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ShellActionRegistry, type ShellActionAliases, type ShellActionHandler } from "./shell-action-registry";

const ShellActionsContext = createContext<ShellActionRegistry | null>(null);

const EMPTY_TYPES: ReadonlySet<string> = new Set();
const noopSubscribe = () => () => {};

export type ShellActionsProviderProps = {
  children: ReactNode;
  /** Maps toolbar action ids (e.g. "projects-refresh") to registered action types (e.g. "projects:refresh"). */
  aliases?: ShellActionAliases;
};

export function ShellActionsProvider({ children, aliases }: ShellActionsProviderProps) {
  const [registry] = useState(() => new ShellActionRegistry(aliases));
  useEffect(() => {
    registry.setAliases(aliases ?? {});
  }, [aliases, registry]);
  return <ShellActionsContext.Provider value={registry}>{children}</ShellActionsContext.Provider>;
}

/** The surrounding registry, or null when no ShellActionsProvider is mounted. */
export function useShellActionsRegistry(): ShellActionRegistry | null {
  return useContext(ShellActionsContext);
}

/**
 * Registers a handler for a shell action type on mount and unregisters it on
 * unmount. The latest handler is kept in a ref so identity changes do not
 * churn registration. As a compatibility bridge for shells that still
 * dispatch window events, the same handler also listens for a window event of
 * the same name (dispatchers invoke the registry OR fire the event, never both).
 */
export function useShellAction<Detail = unknown>(type: string, handler: (detail: Detail) => void): void {
  const registry = useContext(ShellActionsContext);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    const invoke: ShellActionHandler = (detail) => handlerRef.current(detail as Detail);
    const unregister = registry?.register(type, invoke);
    const onWindowEvent = (event: Event) => invoke((event as CustomEvent<Detail>).detail);
    window.addEventListener(type, onWindowEvent);
    return () => {
      unregister?.();
      window.removeEventListener(type, onWindowEvent);
    };
  }, [registry, type]);
}

/**
 * Subscription-based snapshot of the currently registered action types.
 * Re-renders the consumer whenever registration changes. Returns an empty set
 * when no provider is mounted.
 */
export function useRegisteredShellActions(): ReadonlySet<string> {
  const registry = useContext(ShellActionsContext);
  const subscribe = useCallback(
    (onStoreChange: () => void) => (registry ? registry.subscribe(onStoreChange) : noopSubscribe()),
    [registry],
  );
  const getSnapshot = useCallback(() => (registry ? registry.getRegisteredTypes() : EMPTY_TYPES), [registry]);
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_TYPES);
}

/**
 * Whether an action type currently has a registered handler. Without a
 * provider this returns true (legacy window-event dispatch keeps working).
 */
export function useShellActionReady(type: string): boolean {
  const registry = useContext(ShellActionsContext);
  const subscribe = useCallback(
    (onStoreChange: () => void) => (registry ? registry.subscribe(onStoreChange) : noopSubscribe()),
    [registry],
  );
  const getSnapshot = useCallback(() => (registry ? registry.isReady(type) : true), [registry, type]);
  const getServerSnapshot = useCallback(() => (registry ? false : true), [registry]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Whether every action type is ready. Without a provider, legacy dispatch remains enabled. */
export function useShellActionsReady(types: readonly string[]): boolean {
  const registry = useContext(ShellActionsContext);
  useRegisteredShellActions();
  return !registry || registry.areReady(types);
}

/**
 * Pure trigger for a shell toolbar action: invokes the registered handler
 * when a registry is present and has one, otherwise falls back to the
 * provided onToolbarAction callback (legacy behavior without a provider).
 */
export function triggerShellToolbarAction<Action extends { action?: string }>(
  registry: ShellActionRegistry | null,
  action: Action,
  onToolbarAction?: (action: Action) => void,
): void {
  if (registry && action.action && registry.invoke(action.action)) return;
  onToolbarAction?.(action);
}

/**
 * Returns a dispatcher that invokes the registered handler for an action
 * type, falling back to a window event (with alias resolution) when no
 * handler is registered — e.g. for apps that have not migrated a listener yet.
 */
export function useShellActionDispatch(): (type: string, detail?: unknown) => void {
  const registry = useContext(ShellActionsContext);
  return useCallback(
    (type: string, detail?: unknown) => {
      if (registry?.invoke(type, detail)) return;
      if (typeof window === "undefined") return;
      const eventType = registry ? registry.resolveType(type) : type;
      window.dispatchEvent(detail === undefined ? new Event(eventType) : new CustomEvent(eventType, { detail }));
    },
    [registry],
  );
}
