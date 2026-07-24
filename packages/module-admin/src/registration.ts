"use client";

import { Filter, Search, ShieldCheck } from "lucide-react";
import type { ShellContextualAction, ShellModuleRegistration } from "@brightweblabs/app-shell";
import { defaultAdminUiDictionary } from "./ui/dictionary";

export const adminModuleRegistration: ShellModuleRegistration<ShellContextualAction> = {
  key: "admin",
  placement: "admin",
  navItems: [{ href: "/admin/users", label: defaultAdminUiDictionary.navigation.label, icon: ShieldCheck, visibility: "admin" }],
  toolbarRoutes: [
    { surface: "admin-marketing", match: { prefixes: ["/admin/marketing"] } },
    { surface: "admin-users", match: { prefixes: ["/admin/users"] } },
  ],
  toolbarActions: {
    "admin-users": [
      { label: defaultAdminUiDictionary.toolbar.searchPlaceholder, icon: Search, action: "admin-search" },
      { label: defaultAdminUiDictionary.toolbar.filters, icon: Filter, action: "admin-filters" },
    ],
  },
};
