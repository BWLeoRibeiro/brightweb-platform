import { ProjectPill } from "./project-pill";
import { PROJECT_MEMBER_ROLE_LABELS_PT } from "../../contracts";
import type { RoleColor } from "./role-colors";
import { tintPill } from "@brightweblabs/theme/tint";
import { cn } from "../utils";

type MemberRoleBadgeProps = {
  role: string;
  /** Color bucket; when set the pill is tinted and the label follows the bucket. */
  colorRole?: RoleColor | null;
  className?: string;
};

// Base hue token per role bucket, mirroring the avatar palette. Opacity stops
// come from the canonical `.tint-soft` recipe via `tintPill`.
const BADGE_ROLE_TINT: Record<RoleColor, string> = {
  manager: "--role-manager",
  team: "--role-team",
  client: "--role-client",
  admin: "--role-admin",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  member: "Membro",
  owner: PROJECT_MEMBER_ROLE_LABELS_PT.owner,
  contributor: PROJECT_MEMBER_ROLE_LABELS_PT.contributor,
  observer: PROJECT_MEMBER_ROLE_LABELS_PT.observer,
};

export function getMemberRoleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

// A client is shown as "Cliente" and the project owner as "Gestor de projeto",
// regardless of the raw membership role (clients are auto-added as observers).
// "Observador" is therefore reserved for internal people added to watch a project.
export function getMemberDisplayLabel(role: string, colorRole?: RoleColor | null) {
  if (colorRole === "client") return "Cliente";
  if (colorRole === "manager") return PROJECT_MEMBER_ROLE_LABELS_PT.owner;
  return getMemberRoleLabel(role);
}

export function MemberRoleBadge({ role, colorRole, className }: MemberRoleBadgeProps) {
  const tint = colorRole ? tintPill(BADGE_ROLE_TINT[colorRole]) : null;
  return (
    <ProjectPill
      size="small"
      className={cn(
        tint?.className ?? "border-black/8 bg-white/80 text-muted-foreground dark:border-white/15 dark:bg-white/[0.06]",
        className,
      )}
      style={tint?.style}
    >
      {getMemberDisplayLabel(role, colorRole)}
    </ProjectPill>
  );
}
