import type { AuthInvitation } from "./types";

export type InvitationUnavailableKind =
  | "load-error"
  | "not-found"
  | "accepted"
  | "revoked"
  | "expired";

export function resolveInvitationUnavailableKind(
  invitation: AuthInvitation | null,
  failed: boolean,
  now = Date.now(),
): InvitationUnavailableKind | null {
  if (failed) return "load-error";
  if (!invitation) return "not-found";
  if (invitation.status === "accepted") return "accepted";
  if (invitation.status === "revoked") return "revoked";
  if (invitation.status === "expired") return "expired";
  if (new Date(invitation.expiresAt).getTime() <= now) return "expired";
  return null;
}
