"use client";

import { useEffect, useRef } from "react";

export function dispatchWindowEvent(type: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(type));
}

export function dispatchWindowCustomEvent<T>(type: string, detail: T) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(type, { detail }));
}

export function useWindowEventBridge<T = void>(type: string, listener: (detail: T, event: Event) => void, options: { custom?: boolean; enabled?: boolean } = {}) {
  const { custom = true, enabled = true } = options;
  const listenerRef = useRef(listener);
  useEffect(() => { listenerRef.current = listener; }, [listener]);
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: Event) => listenerRef.current(custom ? (event as CustomEvent<T>).detail : undefined as T, event);
    window.addEventListener(type, handler);
    return () => window.removeEventListener(type, handler);
  }, [custom, enabled, type]);
}
