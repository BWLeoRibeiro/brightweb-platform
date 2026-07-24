import type { AdminManagedRole, AdminUsersListResult } from "../users";

export type AdminInviteRole = Extract<AdminManagedRole, "staff" | "admin">;
export type AdminUsersView = "users" | "invites";

export type AdminUserInvitation = {
  id: string;
  email: string;
  role: AdminInviteRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string;
};

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
  listUsers(params: AdminUsersListParams): Promise<AdminUsersListResult>;
  listInvitations(): Promise<AdminUserInvitation[]>;
  inviteUser(input: { email: string; role: AdminInviteRole }): Promise<AdminUserInvitation>;
  revokeInvitation(invitationId: string): Promise<void>;
  changeRoles(input: AdminRoleChangeInput): Promise<AdminRoleChangeSummary>;
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
    title: string;
    description: string;
    updating: string;
    emailLabel: string;
    emailPlaceholder: string;
    roleLabel: string;
    sending: string;
    send: string;
    pendingTitle: string;
    emptyTitle: string;
    emptyHint: string;
    revoke: (email: string) => string;
    emailRequired: string;
    sent: string;
    sendError: string;
    revoked: string;
    revokeError: string;
    loadError: string;
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
