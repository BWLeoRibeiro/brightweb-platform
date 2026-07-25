import type { AccountProfile, AccountProfileInput } from "../../account/profile";

export type AccountUiClient = {
  getProfile(): Promise<AccountProfile>;
  updateProfile(input: AccountProfileInput): Promise<AccountProfile>;
};

export type AccountUiDictionary = {
  locale: string;
  identity: {
    kicker: string;
    fallbackName: string;
    roleLabels: Record<string, string>;
  };
  profile: {
    title: string;
    firstName: string;
    lastName: string;
    email: string;
    language: string;
    preferredLanguage: string;
    firstNamePlaceholder: string;
    lastNamePlaceholder: string;
    portuguese: string;
    english: string;
    emailHint: string;
    edit: string;
    cancel: string;
    save: string;
    loadError: string;
    saveSuccess: string;
    saveError: string;
    emptyValue: string;
  };
  security: {
    title: string;
    email: string;
    updatedAt: string;
    changePassword: string;
    noDate: string;
  };
};
