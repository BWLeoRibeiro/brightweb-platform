"use client";

import { CalendarDays, Filter, Megaphone, Plus, Search, Send } from "lucide-react";
import type { ShellContextualAction, ShellModuleRegistration, ShellRegistrationOverride } from "@brightweblabs/app-shell";

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

/** Opt a client into Social Media navigation, composing its existing customizations. */
export function withSocialMediaNavigation(
  previous?: ShellRegistrationOverride,
): ShellRegistrationOverride {
  return (registration) => {
    const customized = previous ? previous(registration) : registration;
    return {
      ...customized,
      moduleGroups: customized.moduleGroups?.map((group) => {
        if (group.key !== "marketing") return group;
        const children = group.children.map((item) => {
          if (item.href === "/marketing" && !item.activeMatch) {
            return { ...item, activeMatch: { exact: ["/marketing"] } };
          }
          return item;
        });
        if (!children.some((item) => item.href === "/marketing/social-media")) {
          children.push({
            href: "/marketing/social-media",
            label: "Social Media",
            icon: CalendarDays,
            visibility: "staff",
            activeMatch: { exact: ["/marketing/social-media"] },
          });
        }
        return { ...group, children };
      }),
    };
  };
}
