import type { ReactNode } from "react";
import type { GlobalRole } from "../shared";

export type AuthLayoutVariant = "centered" | "split";
export type SignupMode = "invite-only" | "open";
export type OrganizationInvitationRole = "admin" | "member";

export type AuthUiUser = {
  id: string;
  email: string | null;
};

export type AuthUiSession = {
  user: AuthUiUser | null;
};

export type AuthInvitation = {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  kind: "organization" | "admin";
  organizationName?: string;
  role?: GlobalRole | OrganizationInvitationRole;
};

export type AuthPostLoginAccess = {
  user: AuthUiUser | null;
  profileId: string | null;
  role: GlobalRole | null;
  isAdmin: boolean;
  isStaff: boolean;
};

export type RegisterInviteInput = {
  invitationId: string;
  firstName: string;
  lastName: string;
  password: string;
  kind: AuthInvitation["kind"];
};

export interface AuthUiClient {
  getSession(): Promise<AuthUiSession>;
  signOutLocal(): Promise<void>;
  signInWithPassword(input: { email: string; password: string }): Promise<void>;
  sendMagicLink(input: { email: string; redirectTo?: string }): Promise<void>;
  resendConfirmation(input: { email: string; redirectTo?: string }): Promise<void>;
  requestReset(input: { email: string; redirectTo?: string }): Promise<void>;
  exchangeRecoveryCode(code: string): Promise<void>;
  resetPassword(password: string): Promise<void>;
  getInvitation(invitationId: string, kind: AuthInvitation["kind"]): Promise<AuthInvitation | null>;
  registerInvite(input: RegisterInviteInput): Promise<{ email: string }>;
  getPostLoginAccess(): Promise<AuthPostLoginAccess>;
  acceptInvite?(input: { invitationId: string; profileId: string; email: string }): Promise<void>;
}

export type AuthBrandConfig = {
  companyName: string;
  logo: ReactNode;
  helpHref?: string;
  splitHeadline?: string;
  splitDescription?: string;
};

export type AuthUiConfig = {
  brand: AuthBrandConfig;
  client: AuthUiClient;
  signupMode?: SignupMode;
  layoutVariant?: AuthLayoutVariant;
};

export type AuthUiDictionary = {
  locale: "pt-PT";
  common: {
    loading: string;
    retry: string;
    login: string;
    backToLogin: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    newPassword: string;
    showPassword: string;
    hidePassword: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    help: string;
    continue: string;
    back: string;
  };
  layout: {
    footer: (companyName: string) => string;
    splitHeadline: string;
    splitDescription: string;
  };
  login: {
    title: string;
    description: string;
    submit: string;
    submitting: string;
    magicLink: string;
    passwordMode: string;
    magicDescription: string;
    magicSubmit: string;
    magicSubmitting: string;
    magicSent: string;
    forgot: string;
    inviteOnly: string;
    invalid: string;
    unconfirmed: string;
    resendPrompt: string;
    resend: string;
    resending: string;
    resendCooldown: (seconds: number) => string;
    resendSuccess: string;
    resendError: string;
    redirecting: string;
    cleaning: string;
    confirmed: string;
    passwordUpdated: string;
    inviteOnlyMessage: string;
    inviteAccepted: string;
    authSystemError: string;
    authFailed: string;
    sessionReset: string;
  };
  forgot: {
    title: string;
    description: string;
    submit: string;
    submitting: string;
    sentTitle: string;
    checkEmail: string;
    sentDescription: (email: string) => string;
    error: string;
    remember: string;
  };
  reset: {
    title: string;
    description: string;
    submit: string;
    submitting: string;
    preparing: string;
    mismatch: string;
    invalidLink: string;
    error: string;
    passwordHint: string;
  };
  invite: {
    eyebrow: string;
    title: string;
    organizationDescription: (organization: string, email: string) => string;
    adminDescription: (role: string, email: string) => string;
    roleLabels: Record<"admin" | "staff" | "client", string>;
    nameRequired: string;
    mismatch: string;
    create: string;
    creating: string;
    activeSession: string;
    sameAccount: string;
    otherAccount: string;
    sameAccountDescription: string;
    otherAccountDescription: string;
    alreadyAccount: string;
    unavailable: Record<"load-error" | "not-found" | "used" | "expired", { title: string; description: string }>;
    contactForInvite: string;
  };
  confirmed: {
    title: string;
    appDescription: string;
    loginDescription: string;
    redirecting: string;
    continue: string;
  };
  postLogin: {
    preparing: string;
  };
  signup: {
    openTodoTitle: string;
    openTodoDescription: string;
  };
};
