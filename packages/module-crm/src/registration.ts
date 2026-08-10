"use client";

import { BarChart2, Building2, Filter, Plus, Search, UserRound, Users } from "lucide-react";
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
        { href: "/crm/organizations", label: "Organizações", icon: Building2 },
        // No Marketing entry here. module-marketing registers its own nav group
        // at /marketing, and it depends on crm — not the reverse. Advertising a
        // marketing route from crm inverted that dependency and 404'd in both
        // configurations: duplicated (and wrong) when marketing was enabled,
        // and pointing at a module the app did not have when it was not.
        { href: "/crm/report", label: "Relatórios", icon: BarChart2 },
      ],
    },
  ],
  toolbarRoutes: [
    { surface: "crm-report", match: { prefixes: ["/crm/report"] } },
    { surface: "crm-organizations", match: { exact: ["/crm/organizations"] } },
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
