"use client";

import type { ShellContextualAction, ShellModuleRegistration } from "@brightweblabs/app-shell";

export const orgsModuleRegistration: ShellModuleRegistration<ShellContextualAction> = {
  key: "orgs",
  placement: "hidden",
};
