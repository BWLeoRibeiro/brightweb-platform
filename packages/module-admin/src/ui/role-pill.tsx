import type { CSSProperties } from "react";
import type { AdminManagedRole } from "../users";
import type { AdminUiDictionary } from "./types";

const roleTint: Record<AdminManagedRole, CSSProperties> = {
  client: { "--admin-role-tint": "var(--role-client)", "--admin-role-tint-strong": "var(--role-client-strong)" } as CSSProperties,
  staff: { "--admin-role-tint": "var(--role-team)", "--admin-role-tint-strong": "var(--role-team-strong)" } as CSSProperties,
  admin: { "--admin-role-tint": "var(--role-admin)", "--admin-role-tint-strong": "var(--role-admin-strong)" } as CSSProperties,
};

export function AdminRolePill({
  role,
  dictionary,
}: {
  role: AdminManagedRole;
  dictionary: AdminUiDictionary;
}) {
  return (
    <span className="admin-role-pill" style={roleTint[role]}>
      <span className="admin-role-dot" />
      {dictionary.roles[role]}
    </span>
  );
}
