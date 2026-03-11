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
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    scope: "public",
    description: "Supabase anonymous key for browser auth and RPC calls.",
    requiredFor: ["crm", "projects", "admin"],
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    scope: "server",
    description: "Server role key for privileged admin, CRM, and project actions.",
    requiredFor: ["crm", "projects", "admin"],
  },
  {
    key: "RESEND_API_KEY",
    scope: "server",
    description: "Email delivery key for auth and marketing-related server flows.",
    requiredFor: ["core-auth"],
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
