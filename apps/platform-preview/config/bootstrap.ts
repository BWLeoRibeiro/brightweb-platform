import { getStarterClientConfig } from "./client";

export type StarterChecklistItem = {
  label: string;
  done: boolean;
  detail?: string;
};

export type StarterChecklistSection = {
  key: string;
  title: string;
  items: StarterChecklistItem[];
};

function hasModule(moduleKeys: string[], key: string) {
  return moduleKeys.includes(key);
}

export function getStarterBootstrapChecklist() {
  const config = getStarterClientConfig();
  const moduleKeys = config.enabledModules.map((moduleConfig) => moduleConfig.key);

  const identitySection: StarterChecklistSection = {
    key: "identity",
    title: "Client identity",
    items: [
      {
        label: "Define company and product name",
        done: config.brand.companyName !== "Starter Client" && config.brand.productName !== "Operations Platform",
        detail: `${config.brand.companyName} / ${config.brand.productName}`,
      },
      {
        label: "Set client slug",
        done: config.brand.slug !== "starter-client",
        detail: config.brand.slug,
      },
      {
        label: "Set client contact and support inboxes",
        done: config.brand.contactEmail !== "hello@example.com" && config.brand.supportEmail !== "support@example.com",
        detail: `${config.brand.contactEmail} · ${config.brand.supportEmail}`,
      },
    ],
  };

  const envSection: StarterChecklistSection = {
    key: "environment",
    title: "Environment and infrastructure",
    items: config.envStatus.map((item) => ({
      label: `Configure ${item.key}`,
      done: item.present,
      detail: `${item.scope} · ${item.requiredFor.join(", ")}`,
    })),
  };

  const dataSection: StarterChecklistSection = {
    key: "services",
    title: "Client services",
    items: [
      {
        label: "Provision dedicated Supabase project",
        done: config.envStatus.filter((item) => item.key.includes("SUPABASE")).every((item) => item.present),
        detail: "Database, auth, storage, and RPC functions should be client-specific.",
      },
      {
        label: "Configure Resend for the client sender domain",
        done: [
          "RESEND_API_KEY",
          "RESEND_FROM_TRANSACTIONAL",
          "RESEND_FROM_MARKETING",
          "CONTACT_TO_EMAIL",
          "RESEND_WEBHOOK_SECRET",
        ].every((key) => Boolean(config.envStatus.find((item) => item.key === key)?.present)),
        detail: "Use client-owned sender identities and configure webhook signature verification.",
      },
      {
        label: "Create per-client environment variables",
        done: config.envReadiness.allReady,
        detail: "Fill `.env.local` with the real service values for this client.",
      },
    ],
  };

  const modulesSection: StarterChecklistSection = {
    key: "modules",
    title: "Enabled modules",
    items: config.enabledModules.map((moduleConfig) => ({
      label: `Validate ${moduleConfig.label}`,
      done: Boolean(moduleConfig.playgroundHref),
      detail: moduleConfig.playgroundHref
        ? `Preview at ${moduleConfig.playgroundHref}`
        : `Package ${moduleConfig.packageName}`,
    })),
  };

  const rolloutSection: StarterChecklistSection = {
    key: "rollout",
    title: "Launch readiness",
    items: [
      {
        label: "Preview Auth flows",
        done: true,
        detail: "/playground/auth",
      },
      {
        label: "Preview CRM module",
        done: hasModule(moduleKeys, "crm"),
        detail: hasModule(moduleKeys, "crm") ? "/playground/crm" : "CRM not enabled",
      },
      {
        label: "Preview Projects module",
        done: hasModule(moduleKeys, "projects"),
        detail: hasModule(moduleKeys, "projects") ? "/playground/projects" : "Projects not enabled",
      },
      {
        label: "Preview Admin module",
        done: hasModule(moduleKeys, "admin"),
        detail: hasModule(moduleKeys, "admin") ? "/playground/admin" : "Admin not enabled",
      },
      {
        label: "Deploy only after env readiness is green",
        done: config.envReadiness.allReady,
        detail: config.envReadiness.allReady ? "Ready for deploy validation." : `${config.envReadiness.missing.length} env key(s) still missing.`,
      },
    ],
  };

  return {
    client: config,
    sections: [identitySection, envSection, dataSection, modulesSection, rolloutSection],
  };
}
