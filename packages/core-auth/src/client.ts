"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const AUTH_RESEND_COOLDOWN_SECONDS = 60;

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

interface CooldownTimerResult {
  remaining: number;
  isCoolingDown: boolean;
  start: () => void;
  reset: () => void;
}

export function getAuthBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredUrl) {
    throw new Error("Falta NEXT_PUBLIC_APP_URL para redirecionamentos de email de autenticação.");
  }

  try {
    return new URL(configuredUrl).toString().replace(/\/$/, "");
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL inválido. Esperado URL absoluto (ex.: https://exemplo.com).");
  }
}

export function buildSignupCallbackUrl(): string {
  return new URL("auth/callback", `${getAuthBaseUrl()}/`).toString();
}

export function buildResetPasswordRedirectUrl(): string {
  return `${getAuthBaseUrl()}/reset-password`;
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("A palavra-passe deve ter pelo menos 8 caracteres");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("A palavra-passe deve conter pelo menos uma letra maiúscula");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("A palavra-passe deve conter pelo menos uma letra minúscula");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("A palavra-passe deve conter pelo menos um número");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
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
