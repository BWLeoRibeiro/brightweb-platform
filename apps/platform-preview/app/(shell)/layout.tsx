import type { ReactNode } from "react";
import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import { PreviewShellLayoutClient, type ShellViewer } from "./shell-layout-client";

export const dynamic = "force-dynamic";

export default async function PreviewShellLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { supabase, user, role } = await requireServerPageAccess();
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle<{ first_name: string | null; last_name: string | null }>();

  const viewer: ShellViewer = {
    email: user.email ?? null,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    isAdmin: role === "admin",
    isStaff: role === "staff" || role === "admin",
  };

  return <PreviewShellLayoutClient viewer={viewer}>{children}</PreviewShellLayoutClient>;
}
