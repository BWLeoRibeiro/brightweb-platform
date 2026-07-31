export type NotificationItem = {
  id: string;
  summary: string;
  createdAt: string;
  domain: string;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  unreadCount: number;
  seenAt: string | null;
};
