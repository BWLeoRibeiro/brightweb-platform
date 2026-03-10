"use client";

import { ArrowUpDown, BarChart2, Mail, Plus, SlidersHorizontal, UserRound, Users } from "lucide-react";
import type { ShellContextualAction, ShellModuleRegistration } from "@brightweblabs/app-shell";

export const crmModuleRegistration: ShellModuleRegistration<ShellContextualAction> = {
  key: "crm",
  moduleGroups: [
    {
      key: "crm",
      label: "CRM",
      icon: Users,
      children: [
        { href: "/crm", label: "Contactos", icon: UserRound },
        {
          href: "/admin/marketing",
          label: "Email Marketing",
          icon: Mail,
          visibility: "admin",
        },
        { href: "/crm/report", label: "Relatórios", icon: BarChart2 },
      ],
    },
  ],
  toolbarRoutes: [
    { surface: "crm-report", match: { prefixes: ["/crm/report"] } },
    { surface: "crm", match: { exact: ["/crm"] } },
  ],
  toolbarActions: {
    crm: [
      { label: "Organizar tabela", icon: ArrowUpDown, action: "crm-organize-menu" },
      { label: "Segmentar", icon: SlidersHorizontal, action: "crm-segment-menu" },
      { label: "Novo", icon: Plus, action: "crm-new-menu" },
    ],
  },
};
