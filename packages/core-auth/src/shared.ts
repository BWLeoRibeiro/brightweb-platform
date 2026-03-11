export const AUTH_RESEND_COOLDOWN_SECONDS = 60;

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export type GlobalRole = "client" | "staff" | "admin";

const INSIGHTS_CMS_ALLOWED_ROLES: GlobalRole[] = ["admin"];
const DASHBOARD_LANDING_ROLES: GlobalRole[] = ["staff", "admin"];

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

export function normalizeGlobalRole(value: string | null | undefined): GlobalRole | null {
  const normalizedValue = (value ?? "").trim().toLowerCase();
  if (normalizedValue === "client" || normalizedValue === "staff" || normalizedValue === "admin") {
    return normalizedValue;
  }

  return null;
}

export function canAccessInsightsCms(role: string | null | undefined): boolean {
  const normalizedRole = normalizeGlobalRole(role);
  return normalizedRole !== null && INSIGHTS_CMS_ALLOWED_ROLES.some((allowedRole) => allowedRole === normalizedRole);
}

export function resolvePostLoginPath(role: string | null | undefined): "/dashboard" | "/account" {
  const normalizedRole = normalizeGlobalRole(role);
  const shouldLandOnDashboard = normalizedRole !== null
    && DASHBOARD_LANDING_ROLES.some((allowedRole) => allowedRole === normalizedRole);
  return shouldLandOnDashboard ? "/dashboard" : "/account";
}
