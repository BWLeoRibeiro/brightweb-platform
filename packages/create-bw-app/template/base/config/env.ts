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
    description: "Canonical browser-visible URL used by auth callbacks and platform links.",
    requiredFor: ["core-auth"],
  },
  {
    key: "PUBLIC_APP_URL",
    scope: "server",
    description: "Canonical server-side URL used to build Marketing unsubscribe and callback links.",
    requiredFor: ["marketing"],
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    scope: "public",
    description: "Supabase project URL for client-side and server-side API access.",
    requiredFor: ["crm", "marketing", "projects", "admin"],
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
    scope: "public",
    description: "Supabase publishable key for browser auth and RPC calls.",
    requiredFor: ["crm", "marketing", "projects", "admin"],
  },
  {
    key: "SUPABASE_SECRET_DEFAULT_KEY",
    scope: "server",
    description: "Supabase secret key for privileged Admin, CRM, Marketing, and Projects actions.",
    requiredFor: ["crm", "marketing", "projects", "admin"],
  },
  {
    key: "RESEND_API_KEY",
    scope: "server",
    description: "Resend API key injected into Marketing email delivery.",
    requiredFor: ["marketing"],
  },
  {
    key: "RESEND_WEBHOOK_SECRET",
    scope: "server",
    description: "Svix signing secret used to verify inbound Resend event payloads.",
    requiredFor: ["marketing"],
  },
  {
    key: "MARKETING_WORKER_SECRET",
    scope: "server",
    description: "Bearer secret required to invoke the internal Marketing worker endpoint.",
    requiredFor: ["marketing"],
  },
  {
    key: "MARKETING_FROM_EMAIL",
    scope: "server",
    description: "Verified sender address for Marketing campaigns; falls back to RESEND_FROM_EMAIL.",
    requiredFor: ["marketing"],
  },
  {
    key: "MARKETING_FROM_NAME",
    scope: "server",
    description: "Display name for Marketing campaign email.",
    requiredFor: ["marketing"],
  },
];

export function getStarterEnvStatus() {
  return starterEnvRequirements.map(
    (requirement) =>
      ({
        ...requirement,
        present:
          typeof process.env[requirement.key] === "string"
          && process.env[requirement.key]!.trim().length > 0,
      }) satisfies StarterEnvStatus,
  );
}

export function isStarterEnvReady(requiredModules: string[]) {
  const relevant = getStarterEnvStatus().filter((item) =>
    item.requiredFor.some((moduleKey) => requiredModules.includes(moduleKey)),
  );
  return {
    allReady: relevant.every((item) => item.present),
    items: relevant,
    missing: relevant.filter((item) => !item.present),
  };
}
