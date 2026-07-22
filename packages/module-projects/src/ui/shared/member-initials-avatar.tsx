import { Avatar, AvatarFallback } from "@brightweblabs/ui";
import { cn } from "../utils";

type MemberInitialsAvatarTone = "active" | "subtle";

type MemberInitialsAvatarProps = {
  label?: string | null;
  email?: string | null;
  tone?: MemberInitialsAvatarTone;
  className?: string;
};

function getInitials(label?: string | null, email?: string | null) {
  const source = (label || email || "?").trim();
  if (!source) return "?";
  return source
    .split(/\s+/)
    .map((token) => token.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const toneClasses: Record<MemberInitialsAvatarTone, { avatar: string; fallback: string }> = {
  active: {
    avatar: "size-8 bg-gradient-to-br from-primary/20 to-secondary/20",
    fallback: "paragraph-mini font-bold uppercase text-primary bg-transparent",
  },
  subtle: {
    avatar: "size-9 bg-primary/10",
    fallback: "paragraph-mini font-bold uppercase text-primary bg-transparent",
  },
};

export function MemberInitialsAvatar({ label, email, tone = "active", className }: MemberInitialsAvatarProps) {
  const initials = getInitials(label, email);
  const classes = toneClasses[tone];

  return (
    <Avatar className={cn("shrink-0", classes.avatar, className)}>
      <AvatarFallback className={classes.fallback}>{initials}</AvatarFallback>
    </Avatar>
  );
}
