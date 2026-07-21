import type { ComponentProps } from "react";

import { getRoleLabel, resolveRoleToken } from "../lib/patterns";
import { StatusPill } from "./status-pill";

export const DEFAULT_ROLE_TOKEN_MAP = {
  admin: "--role-admin",
  client: "--role-client",
  manager: "--role-manager",
  team: "--role-team",
} as const;

export type RoleBadgeProps = Omit<ComponentProps<typeof StatusPill>, "children" | "token"> & {
  role: string;
  label?: string;
  tokenMap?: Readonly<Record<string, string>>;
  fallbackToken?: string;
};

export function RoleBadge({
  role,
  label,
  tokenMap = DEFAULT_ROLE_TOKEN_MAP,
  fallbackToken = "--semantic-neutral",
  ...props
}: RoleBadgeProps) {
  return (
    <StatusPill token={resolveRoleToken(role, tokenMap, fallbackToken)} {...props}>
      {label ?? getRoleLabel(role)}
    </StatusPill>
  );
}

export { getRoleLabel, resolveRoleToken } from "../lib/patterns";
