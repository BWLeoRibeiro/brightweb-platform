export type NotificationItem = {
  id: string;
  summary: string;
  createdAt: string;
  domain: string;
  eventType?: string;
  actorProfileId?: string | null;
  actorLabel?: string | null;
  payload?: Record<string, unknown>;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  unreadCount: number;
  seenAt: string | null;
};
