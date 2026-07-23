"use client";

import { useMemo, useState } from "react";
import {
  AdminUsersClient,
  type AdminUiClient,
  type AdminUserInvitation,
} from "@brightweblabs/module-admin/ui";
import type {
  AdminManagedRole,
  AdminUserRow,
  AdminUsersListResult,
} from "@brightweblabs/module-admin/users";

const seedUsers: AdminUserRow[] = [
  { profileId: "profile-ada", name: "Ada Lovelace", email: "ada@analytical.example", role: "admin", createdAt: "2026-05-04T09:00:00.000Z", updatedAt: "2026-07-19T14:30:00.000Z" },
  { profileId: "profile-grace", name: "Grace Hopper", email: "grace@compiler.example", role: "staff", createdAt: "2026-05-09T10:00:00.000Z", updatedAt: "2026-07-18T11:45:00.000Z" },
  { profileId: "profile-katherine", name: "Katherine Johnson", email: "katherine@orbital.example", role: "client", createdAt: "2026-05-14T11:00:00.000Z", updatedAt: "2026-07-17T16:20:00.000Z" },
  { profileId: "profile-margaret", name: "Margaret Hamilton", email: "margaret@lunar.example", role: "staff", createdAt: "2026-05-21T12:00:00.000Z", updatedAt: "2026-07-16T13:10:00.000Z" },
  { profileId: "profile-radia", name: "Radia Perlman", email: "radia@network.example", role: "client", createdAt: "2026-06-02T13:00:00.000Z", updatedAt: "2026-07-15T09:25:00.000Z" },
  { profileId: "profile-annie", name: "Annie Easley", email: "annie@energy.example", role: "admin", createdAt: "2026-06-08T14:00:00.000Z", updatedAt: "2026-07-14T10:15:00.000Z" },
];

const seedInvitations: AdminUserInvitation[] = [
  { id: "invite-hedy", email: "hedy@wireless.example", role: "staff", status: "pending", createdAt: "2026-07-20T09:00:00.000Z", expiresAt: "2026-07-27T09:00:00.000Z" },
  { id: "invite-mary", email: "mary@cobol.example", role: "admin", status: "pending", createdAt: "2026-07-21T10:00:00.000Z", expiresAt: "2026-07-28T10:00:00.000Z" },
];

function listUsers(
  users: AdminUserRow[],
  params: { search?: string; role?: AdminManagedRole | null; page: number; pageSize: number },
): AdminUsersListResult {
  const search = params.search?.trim().toLowerCase();
  const filtered = users.filter((user) => {
    const matchesSearch = !search || `${user.name} ${user.email}`.toLowerCase().includes(search);
    return matchesSearch && (!params.role || user.role === params.role);
  });
  return {
    data: filtered.slice((params.page - 1) * params.pageSize, params.page * params.pageSize),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / params.pageSize)),
    },
  };
}

export default function AdminUsersPreviewPage() {
  const [users, setUsers] = useState(seedUsers);
  const [invitations, setInvitations] = useState(seedInvitations);
  const client = useMemo<AdminUiClient>(() => ({
    async listUsers(params) { return listUsers(users, params); },
    async listInvitations() { return invitations; },
    async inviteUser(input) {
      const invitation: AdminUserInvitation = {
        id: `invite-${Date.now()}`,
        email: input.email,
        role: input.role,
        status: "pending",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      };
      setInvitations((current) => [invitation, ...current]);
      return invitation;
    },
    async revokeInvitation(invitationId) {
      setInvitations((current) => current.filter((invite) => invite.id !== invitationId));
    },
    async changeRoles(input) {
      let changed = 0;
      setUsers((current) => current.map((user) => {
        if (!input.profileIds.includes(user.profileId) || user.role === input.newRole) return user;
        changed += 1;
        return { ...user, role: input.newRole, updatedAt: new Date().toISOString() };
      }));
      return { changed, skipped: input.profileIds.length - changed };
    },
  }), [invitations, users]);

  return <AdminUsersClient initialUsers={listUsers(users, { page: 1, pageSize: 10 })} client={client} />;
}
