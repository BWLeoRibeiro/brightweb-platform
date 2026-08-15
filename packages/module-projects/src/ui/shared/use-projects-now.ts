"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let currentNow: Date | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function refreshNow() {
  currentNow = new Date();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (listeners.size === 1) {
    currentNow = new Date();
    refreshTimer = setInterval(refreshNow, 60_000);
  }

  queueMicrotask(() => {
    if (listeners.has(listener)) listener();
  });

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
      currentNow = null;
    }
  };
}

function getSnapshot() {
  return currentNow;
}

function getServerSnapshot() {
  return null;
}

/** Keeps live time out of the server and hydration renders, then refreshes once per minute. */
export function useProjectsNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
