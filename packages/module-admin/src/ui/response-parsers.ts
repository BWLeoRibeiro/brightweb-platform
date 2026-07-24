import type { AdminManagedRole, AdminUsersListResult } from "../users";
import type { AdminRoleChangeSummary, AdminUserInvitation } from "./types";

type RecordValue = Record<string, unknown>;

function record(value: unknown, label: string): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Invalid ${label} response.`);
  return value as RecordValue;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`Invalid ${label} response.`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value !== null && typeof value !== "string") throw new Error(`Invalid ${label} response.`);
  return value as string | null;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ${label} response.`);
  return value;
}

function role(value: unknown, label: string): AdminManagedRole {
  if (value !== "client" && value !== "staff" && value !== "admin") throw new Error(`Invalid ${label} response.`);
  return value;
}

function array<T>(value: unknown, parser: (item: unknown) => T, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label} response.`);
  return value.map(parser);
}

export function parseAdminUsersResponse(value: unknown): AdminUsersListResult {
  const payload = record(value, "admin users");
  const pagination = record(payload.pagination, "admin users pagination");
  return {
    data: array(payload.data, (rowValue) => {
      const row = record(rowValue, "admin user");
      return {
        profileId: string(row.profileId, "admin user"),
        name: string(row.name, "admin user"),
        email: string(row.email, "admin user"),
        role: role(row.role, "admin user"),
        createdAt: string(row.createdAt, "admin user"),
        updatedAt: nullableString(row.updatedAt, "admin user"),
      };
    }, "admin users"),
    pagination: {
      page: number(pagination.page, "admin users pagination"),
      pageSize: number(pagination.pageSize, "admin users pagination"),
      total: number(pagination.total, "admin users pagination"),
      totalPages: number(pagination.totalPages, "admin users pagination"),
    },
  };
}

function parseInvitation(value: unknown): AdminUserInvitation {
  const invitation = record(value, "admin invitation");
  const invitationRole = role(invitation.role, "admin invitation");
  if (invitationRole === "client") throw new Error("Invalid admin invitation response.");
  if (
    invitation.status !== "pending"
    && invitation.status !== "accepted"
    && invitation.status !== "revoked"
    && invitation.status !== "expired"
  ) {
    throw new Error("Invalid admin invitation response.");
  }
  return {
    id: string(invitation.id, "admin invitation"),
    email: string(invitation.email, "admin invitation"),
    role: invitationRole,
    status: invitation.status,
    createdAt: string(invitation.createdAt, "admin invitation"),
    expiresAt: string(invitation.expiresAt, "admin invitation"),
  };
}

export function parseAdminInvitationsResponse(value: unknown): AdminUserInvitation[] {
  const payload = record(value, "admin invitations");
  return array(payload.data, parseInvitation, "admin invitations");
}

export function parseAdminInvitationWriteResponse(value: unknown): AdminUserInvitation {
  return parseInvitation(record(value, "admin invitation write").data);
}

export function parseAdminInvitationDeleteResponse(value: unknown): void {
  string(record(record(value, "admin invitation delete").data, "admin invitation delete").id, "admin invitation delete");
}

export function parseAdminRoleChangeResponse(value: unknown): AdminRoleChangeSummary {
  const payload = record(value, "admin role change");
  const changed = array(payload.changed, (itemValue) => {
    const item = record(itemValue, "admin changed role");
    string(item.profileId, "admin changed role");
    nullableString(item.oldRole, "admin changed role");
    string(item.newRole, "admin changed role");
    string(item.reason, "admin changed role");
  }, "admin changed roles");
  const skipped = array(payload.skipped, (itemValue) => {
    const item = record(itemValue, "admin skipped role");
    string(item.profileId, "admin skipped role");
    string(item.reason, "admin skipped role");
  }, "admin skipped roles");
  const summary = record(payload.summary, "admin role summary");
  const requested = number(summary.requested, "admin role summary");
  const changedCount = number(summary.changed, "admin role summary");
  const skippedCount = number(summary.skipped, "admin role summary");
  if (changed.length !== changedCount || skipped.length !== skippedCount || requested !== changedCount + skippedCount) {
    throw new Error("Invalid admin role summary response.");
  }
  return { changed: changedCount, skipped: skippedCount };
}
