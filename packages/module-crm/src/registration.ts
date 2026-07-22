"use client";

import { BarChart2, Filter, Mail, Plus, Search, UserRound, Users } from "lucide-react";
import type { ShellContextualAction, ShellModuleRegistration } from "@brightweblabs/app-shell";

export const crmModuleRegistration: ShellModuleRegistration<ShellContextualAction> = {
  key: "crm",
  dashboardContribution: { key: "crm", sections: ["crm"] },
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
      { label: "Procurar contactos", icon: Search, action: "crm-search" },
      { label: "Filtros", icon: Filter, action: "crm-filters" },
      { label: "Criar", icon: Plus, action: "crm-create-menu" },
    ],
  },
};
