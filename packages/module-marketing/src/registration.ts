"use client";

import { Megaphone, Send } from "lucide-react";
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
};
