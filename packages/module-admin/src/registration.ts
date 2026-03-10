"use client";

import { ShieldCheck } from "lucide-react";
import type { ShellContextualAction, ShellModuleRegistration } from "@brightweblabs/app-shell";

export const adminModuleRegistration: ShellModuleRegistration<ShellContextualAction> = {
  key: "admin",
  placement: "admin",
  navItems: [{ href: "/admin/users", label: "Painel de Administração", icon: ShieldCheck, visibility: "admin" }],
  toolbarRoutes: [
    { surface: "admin-marketing", match: { prefixes: ["/admin/marketing"] } },
    { surface: "admin-users", match: { prefixes: ["/admin/users"] } },
  ],
};
