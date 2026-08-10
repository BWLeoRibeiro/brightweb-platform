import type { AdminManagedRole, AdminUsersListResult } from "../users";
import type { UiRequestMetricObserver } from "@brightweblabs/infra/request-observability";

export type AdminInviteRole = AdminManagedRole;
export type AdminUsersView = "users" | "invites";

export type AdminUserInvitation = {
  id: string;
  email: string;
  role: AdminInviteRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string;
  source?: "global" | "organization";
  organizationId?: string | null;
  organizationName?: string | null;
  organizationRole?: "admin" | "member" | null;
};

export type AdminOrganizationOption = { id: string; name: string };

export type AdminUsersListParams = {
  search?: string;
  role?: AdminManagedRole | null;
  page: number;
  pageSize: number;
};

export type AdminRoleChangeInput = {
  profileIds: string[];
  newRole: AdminManagedRole;
  reason: string;
};

export type AdminRoleChangeSummary = {
  changed: number;
  skipped: number;
};

export type AdminUiClient = {
  listUsers(params: AdminUsersListParams, options?: { signal?: AbortSignal }): Promise<AdminUsersListResult>;
  listInvitations(): Promise<AdminUserInvitation[]>;
  listOrganizations(): Promise<AdminOrganizationOption[]>;
  inviteUser(input: { email: string; role: AdminInviteRole; organizationId?: string; organizationName?: string; organizationRole?: "admin" | "member" }): Promise<AdminUserInvitation>;
  revokeInvitation(invitation: AdminUserInvitation): Promise<void>;
  changeRoles(input: AdminRoleChangeInput): Promise<AdminRoleChangeSummary>;
};

export type AdminUiClientOptions = {
  onRequestMetric?: UiRequestMetricObserver;
};

export type AdminUiDictionary = {
  locale: string;
  navigation: {
    label: string;
    kicker: string;
    title: string;
  };
  roles: Record<AdminManagedRole, string>;
  views: {
    users: string;
    invites: string;
  };
  users: {
    emptyTitle: string;
    emptyHint: string;
    selectAll: string;
    selectUser: (email: string) => string;
    changeRole: (email: string) => string;
    summary: (visible: number, total: number) => string;
    loadError: string;
    columns: {
      name: string;
      email: string;
      role: string;
      created: string;
      updated: string;
    };
  };
  invitations: {
    open: string;
    cancel: string;
    createEyebrow: string;
    identity: string;
    title: string;
    description: string;
    formHint?: string;
    roleDescriptions?: Partial<Record<AdminInviteRole, string>>;
    updating: string;
    searchPlaceholder: string;
    statusFilterLabel: string;
    statusFilters: Record<"all" | "pending" | "accepted" | "expired" | "revoked", string>;
    statusLabels: Record<"pending" | "accepted" | "expired" | "revoked", string>;
    emailLabel: string;
    emailPlaceholder: string;
    roleLabel: string;
    organizationTitle: string;
    organizationDescription: string;
    organizationLabel: string;
    organizationPlaceholder: string;
    organizationRoleLabel: string;
    organizationRoles: Record<"admin" | "member", string>;
    sending: string;
    send: string;
    pendingTitle: string;
    historyTitle: string;
    emptyTitle: string;
    emptyHint: string;
    historyEmptyTitle: string;
    historyEmptyHint: string;
    revoke: (email: string) => string;
    emailRequired: string;
    sent: string;
    sentTo?: (email: string) => string;
    sendError: string;
    revoked: string;
    revokeError: string;
    loadError: string;
    retry?: string;
    expirySoon?: (days: number) => string;
    expiresToday?: string;
    expired?: string;
    confirmRevokeTitle?: string;
    confirmRevokeDescription?: (email: string) => string;
    cancelRevoke?: string;
    confirmRevoke?: string;
    revoking?: string;
    summary: (visible: number, total: number) => string;
    columns: {
      email: string;
      role: string;
      created: string;
      expires: string;
      actions: string;
    };
  };
  roleChange: {
    selectRequired: string;
    alreadyAssigned: (role: string) => string;
    unchanged: (count: number) => string;
    noChanges: string;
    reasonRequired: string;
    updateError: string;
    changed: (count: number) => string;
    skipped: (count: number) => string;
    bulkTitle: string;
    singleTitle: string;
    bulkDescription: (role: string, count: number) => string;
    singleDescription: (role: string) => string;
    reason: string;
    reasonPlaceholder: string;
    cancel: string;
    applying: string;
    confirm: string;
  };
  pagination: {
    previous: string;
    next: string;
    page: (page: number, totalPages: number) => string;
  };
  toolbar: {
    searchPlaceholder: string;
    filters: string;
    clear: string;
    role: string;
    allRoles: string;
    apply: string;
  };
};
