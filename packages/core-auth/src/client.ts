"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CooldownTimerResult {
  remaining: number;
  isCoolingDown: boolean;
  start: () => void;
  reset: () => void;
}

export function useCooldownTimer(durationSeconds: number): CooldownTimerResult {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setRemaining(0);
  }, [clearTimer]);

  const start = useCallback(() => {
    setRemaining(durationSeconds);
    clearTimer();

    intervalRef.current = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          clearTimer();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }, [clearTimer, durationSeconds]);

  useEffect(() => reset, [reset]);

  return {
    remaining,
    isCoolingDown: remaining > 0,
    start,
    reset,
  };
}
