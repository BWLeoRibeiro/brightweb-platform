export type SubscriptionStatus = "subscribed" | "unsubscribed";

export type SuppressionReason =
  | "bounced"
  | "complained"
  | "unsubscribed_all"
  | "manual";

export type ConsentSource =
  | "form"
  | "import"
  | "manual"
  | "api"
  | "unsubscribe"
  | (string & {});

export type MarketingTopic = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type MarketingSubscription = {
  id: string;
  contactId: string;
  topicId: string;
  status: SubscriptionStatus;
  consentSource: string | null;
  consentAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactSubscriptionState = {
  topic: MarketingTopic;
  status: SubscriptionStatus | null;
  consentAt: string | null;
  unsubscribedAt: string | null;
};

export type MarketingContactSettings = {
  contactId: string;
  unsubscribeToken: string;
  preferredLanguage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedUnsubscribeContact = {
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
  email: string | null;
  subscriptions: ContactSubscriptionState[];
};
