// Shared role-color vocabulary for user avatars across the portal.
//
// Buckets (see globals.css `--role-*` tokens):
//   team    → BeGreen staff/admin (internal). Admins fold into team on avatars;
//             their distinct `admin` color is reserved for the admin panel badges.
//   client  → people from a client organization (primary contact, org admin/member).
//   manager → the highlighted project owner.
//   accent  → neutral fallback when the person's role is unknown.
export type RoleColor = "team" | "client" | "manager" | "admin";
export type AvatarRoleColor = RoleColor | "accent";

// Global account role as stored in `user_role_assignments.role_code`.
export type GlobalAccountRole = "client" | "staff" | "admin";

// Project membership role as stored in `project_members.role`.
export type ProjectMemberColorRole = "owner" | "contributor" | "observer";

// Avatar chip classes: a tinted background with a legible role-strong ink.
const AVATAR_ROLE_CLASS: Record<AvatarRoleColor, string> = {
  team: "bg-[color:var(--project-ui-color-73)] text-[color:var(--role-team-strong)]",
  client: "bg-[color:var(--project-ui-color-74)] text-[color:var(--role-client-strong)]",
  manager: "bg-[color:var(--project-ui-color-75)] text-[color:var(--role-manager-strong)]",
  admin: "bg-[color:var(--project-ui-color-76)] text-[color:var(--role-admin-strong)]",
  accent:
    "bg-[color:var(--project-ui-color-77)] text-[color:var(--project-ui-color-78)] dark:text-[var(--project-ui-color-79)]",
};

export function avatarRoleClass(role: AvatarRoleColor | null | undefined): string {
  return AVATAR_ROLE_CLASS[role ?? "accent"];
}

// Map a person's global account role to an avatar bucket. Staff and admin both
// render as `team` on avatars (the user picked a 3-bucket avatar scheme).
export function globalRoleToColor(role: GlobalAccountRole | null | undefined): AvatarRoleColor {
  if (role === "client") return "client";
  if (role === "staff" || role === "admin") return "team";
  return "accent";
}

// Best-effort color from only a project membership role — used when the person's
// internal/external identity is unavailable (e.g. realtime-added member). The
// real distinction (internal observer vs client) needs the global role, so this
// is a fallback, not the source of truth.
export function memberRoleToColorFallback(role: ProjectMemberColorRole | string | null | undefined): AvatarRoleColor {
  if (role === "owner") return "manager";
  if (role === "observer") return "client";
  if (role === "contributor") return "team";
  return "accent";
}
