"use client";

import { Filter, Megaphone, Plus, Search, Send } from "lucide-react";
import type { ShellContextualAction, ShellModuleRegistration } from "@brightweblabs/app-shell";

export const marketingModuleRegistration: ShellModuleRegistration<ShellContextualAction> = {
  key: "marketing",
  moduleGroups: [
    {
      key: "marketing",
      label: "Marketing",
      icon: Megaphone,
      children: [
        { href: "/marketing", label: "Campanhas", icon: Send, visibility: "staff" },
      ],
    },
  ],
  toolbarRoutes: [{ surface: "marketing", match: { exact: ["/marketing"] } }],
  toolbarActions: {
    marketing: [
      { label: "Procurar marketing", icon: Search, action: "marketing:set-search" },
      { label: "Filtros", icon: Filter, action: "marketing:set-status-filter" },
      { label: "Criar", icon: Plus, action: "marketing:create" },
    ],
  },
};
