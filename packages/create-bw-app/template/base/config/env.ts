export type StarterEnvScope = "public" | "server";

export type StarterEnvRequirement = {
  key: string;
  scope: StarterEnvScope;
  description: string;
  requiredFor: string[];
};

export type StarterEnvStatus = StarterEnvRequirement & {
  present: boolean;
};

export const starterEnvRequirements: StarterEnvRequirement[] = [
  {
    key: "NEXT_PUBLIC_APP_URL",
    scope: "public",
    description: "Canonical base URL used by auth callbacks and platform links.",
    requiredFor: ["core-auth"],
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    scope: "public",
    description: "Supabase project URL for client-side and server-side API access.",
    requiredFor: ["crm", "projects", "admin"],
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
    scope: "public",
    description: "Supabase publishable key for browser auth and RPC calls.",
    requiredFor: ["crm", "projects", "admin"],
  },
  {
    key: "SUPABASE_SECRET_DEFAULT_KEY",
    scope: "server",
    description: "Supabase secret key for privileged admin, CRM, and project actions.",
    requiredFor: ["crm", "projects", "admin"],
  },
  {
    key: "RESEND_API_KEY",
    scope: "server",
    description: "Email delivery key for app-owned transactional and marketing server flows.",
    requiredFor: ["admin"],
  },
  {
    key: "RESEND_FROM_TRANSACTIONAL",
    scope: "server",
    description: "Default transactional sender used by app-owned invite/contact email flows.",
    requiredFor: ["admin"],
  },
  {
    key: "RESEND_FROM_MARKETING",
    scope: "server",
    description: "Default marketing sender used by campaign and workflow email flows.",
    requiredFor: ["admin"],
  },
  {
    key: "CONTACT_TO_EMAIL",
    scope: "server",
    description: "Destination inbox for app-owned contact notifications.",
    requiredFor: ["admin"],
  },
  {
    key: "RESEND_WEBHOOK_SECRET",
    scope: "server",
    description: "Webhook signing secret used to verify inbound Resend event payloads.",
    requiredFor: ["admin"],
  },
  {
    key: "MARKETING_WORKER_SECRET",
    scope: "server",
    description: "Shared secret required to trigger internal marketing worker endpoints.",
    requiredFor: ["admin"],
  },
  {
    key: "MARKETING_TEST_EMAIL",
    scope: "server",
    description: "Inbox used by admin marketing test send actions.",
    requiredFor: ["admin"],
  },
];

export function getStarterEnvStatus() {
  return starterEnvRequirements.map(
    (requirement) =>
      ({
        ...requirement,
        present: typeof process.env[requirement.key] === "string" && process.env[requirement.key]!.trim().length > 0,
      }) satisfies StarterEnvStatus,
  );
}

export function isStarterEnvReady(requiredModules: string[]) {
  const relevant = getStarterEnvStatus().filter((item) => item.requiredFor.some((moduleKey) => requiredModules.includes(moduleKey)));
  return {
    allReady: relevant.every((item) => item.present),
    items: relevant,
    missing: relevant.filter((item) => !item.present),
  };
}
