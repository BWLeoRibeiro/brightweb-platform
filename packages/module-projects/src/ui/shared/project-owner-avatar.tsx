import { cn } from "../utils";
import { avatarRoleClass, type AvatarRoleColor } from "./role-colors";

type ProjectOwnerAvatarSize = "sm" | "md";

type ProjectOwnerAvatarProps = {
  label?: string | null;
  size?: ProjectOwnerAvatarSize;
  /** Role bucket that tints the chip. Omit for the neutral accent fallback. */
  roleColor?: AvatarRoleColor | null;
  className?: string;
};

const SIZE_CLASSES: Record<ProjectOwnerAvatarSize, string> = {
  sm: "h-5 w-5 text-[length:var(--text-ui-fine)]",
  md: "h-8 w-8 text-[length:var(--text-ui-label)]",
};

export function ownerInitials(label: string | null | undefined) {
  if (!label) return "—";
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? "" : "";
  return (first + last).toUpperCase() || "—";
}

// Role-tinted initials chip shared by the portfolio card, the detail hero, and
// the team list so people are represented identically across the surface. The
// background/ink come from the shared role palette; without a role it falls back
// to the neutral accent tint it has always used.
export function ProjectOwnerAvatar({ label, size = "sm", roleColor, className }: ProjectOwnerAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-extrabold",
        avatarRoleClass(roleColor),
        SIZE_CLASSES[size],
        className,
      )}
    >
      {ownerInitials(label)}
    </span>
  );
}
