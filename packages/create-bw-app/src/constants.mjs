export const CLI_PACKAGE_NAME = "create-bw-app";
export const CLI_DISPLAY_NAME = "create-bw-app";

export const TEMPLATE_OPTIONS = [
  {
    key: "platform",
    label: "Platform app",
    description: "Authenticated BrightWeb app shell with optional business modules.",
  },
  {
    key: "site",
    label: "Site",
    description: "Thin Next.js + Tailwind site shell for package-owned surfaces.",
  },
];

export const SELECTABLE_MODULES = [
  {
    key: "crm",
    label: "CRM",
    packageName: "@brightweblabs/module-crm",
    templateFolder: "crm",
  },
  {
    key: "marketing",
    label: "Marketing",
    packageName: "@brightweblabs/module-marketing",
    templateFolder: "marketing",
  },
  {
    key: "projects",
    label: "Projects",
    packageName: "@brightweblabs/module-projects",
    templateFolder: "projects",
  },
  {
    key: "admin",
    label: "Admin",
    packageName: "@brightweblabs/module-admin",
    templateFolder: "admin",
  },
];

export const CORE_PACKAGES = [
  "@brightweblabs/app-shell",
  "@brightweblabs/core-auth",
  "@brightweblabs/infra",
  "@brightweblabs/theme",
  "@brightweblabs/ui",
];

export const ORGS_PACKAGE_NAME = "@brightweblabs/module-orgs";

export const BRIGHTWEB_PACKAGE_NAMES = [
  ...CORE_PACKAGES,
  ORGS_PACKAGE_NAME,
  ...SELECTABLE_MODULES.map((moduleDefinition) => moduleDefinition.packageName),
];

export const MODULE_STARTER_FILES = {
  admin: [
    "app/api/admin/users/route.ts",
    "app/api/admin/users/roles/route.ts",
    "app/api/admin/users/invitations/route.ts",
    "app/api/admin/users/invitations/[invitationId]/route.ts",
    "app/(shell)/admin/users/page.tsx",
  ],
  crm: [
    "app/(shell)/crm/layout.tsx",
    "app/(shell)/crm/page.tsx",
    "app/(shell)/crm/report/page.tsx",
    "app/api/crm/contacts/route.ts",
    "app/api/dashboard/crm/route.ts",
    "app/api/crm/organizations/route.ts",
    "app/api/crm/owners/route.ts",
    "app/api/crm/report/route.ts",
    "app/api/crm/stats/route.ts",
    "app/api/crm/timeline/route.ts",
  ],
  marketing: [
    "app/(shell)/marketing/page.tsx",
    "app/api/marketing/_handlers.ts",
    "app/api/marketing/analytics/campaigns/[id]/route.ts",
    "app/api/marketing/analytics/overview/route.ts",
    "app/api/marketing/analytics/segments/[id]/route.ts",
    "app/api/marketing/campaigns/[id]/cancel/route.ts",
    "app/api/marketing/campaigns/[id]/recipients/[recipientId]/route.ts",
    "app/api/marketing/campaigns/[id]/recipients/route.ts",
    "app/api/marketing/campaigns/[id]/retry/route.ts",
    "app/api/marketing/campaigns/[id]/route.ts",
    "app/api/marketing/campaigns/[id]/schedule/route.ts",
    "app/api/marketing/campaigns/[id]/send/route.ts",
    "app/api/marketing/campaigns/[id]/test/route.ts",
    "app/api/marketing/campaigns/route.ts",
    "app/api/marketing/segments/[id]/preview/route.ts",
    "app/api/marketing/segments/[id]/route.ts",
    "app/api/marketing/segments/preview/route.ts",
    "app/api/marketing/segments/route.ts",
    "app/api/marketing/topics/route.ts",
  "app/api/marketing/topics/[id]/route.ts",
  "app/api/marketing/topics/order/route.ts",
    "app/api/marketing/unsubscribe/[token]/route.ts",
    "app/api/marketing/webhooks/resend/route.ts",
    "app/api/marketing/worker/route.ts",
    "app/api/marketing/workflows/[id]/activate/route.ts",
    "app/api/marketing/workflows/[id]/nodes/[nodeId]/route.ts",
    "app/api/marketing/workflows/[id]/nodes/route.ts",
    "app/api/marketing/workflows/[id]/pause/route.ts",
    "app/api/marketing/workflows/[id]/route.ts",
    "app/api/marketing/workflows/[id]/runs/route.ts",
    "app/api/marketing/workflows/route.ts",
  ],
  projects: [
    "app/(shell)/projetos/layout.tsx",
    "app/(shell)/projetos/page.tsx",
    "app/(shell)/projetos/projetos-live-mounts.tsx",
    "app/(shell)/projetos/projetos-server-mounts.tsx",
    "app/(shell)/projetos/[projectId]/page.tsx",
    "app/(shell)/projetos/[projectId]/quadro/page.tsx",
    "app/(shell)/projetos/[projectId]/tarefas/page.tsx",
    "app/(shell)/account/projetos/page.tsx",
    "app/(shell)/account/projetos/loading.tsx",
    "app/(shell)/account/projetos/[projectId]/page.tsx",
    "app/(shell)/account/projetos/[projectId]/loading.tsx",
    "app/api/projects/_handlers.ts",
    "app/api/dashboard/projects/route.ts",
    "app/api/dashboard/tasks/route.ts",
    "app/api/projects/route.ts",
    "app/api/projects/stats/route.ts",
    "app/api/projects/organizations/route.ts",
    "app/api/projects/[id]/route.ts",
    "app/api/projects/[id]/activity/route.ts",
    "app/api/projects/[id]/members/route.ts",
    "app/api/projects/[id]/links/route.ts",
    "app/api/projects/[id]/links/[itemId]/route.ts",
    "app/api/projects/[id]/milestones/route.ts",
    "app/api/projects/[id]/milestones/[itemId]/route.ts",
    "app/api/projects/[id]/tasks/route.ts",
    "app/api/projects/[id]/tasks/[itemId]/route.ts",
  ],
};

export const PLATFORM_STARTER_FILES = [
  "app/(auth)/auth-provider.tsx",
  "app/(auth)/layout.tsx",
  "app/(auth)/login/page.tsx",
  "app/(auth)/forgot-password/page.tsx",
  "app/(auth)/reset-password/page.tsx",
  "app/(auth)/auth/post-login/page.tsx",
  "app/(auth)/auth/confirmed/page.tsx",
  "app/(auth)/admin-invite/[invitationId]/page.tsx",
  "app/(auth)/invite/[invitationId]/page.tsx",
  "app/(auth)/invite/[invitationId]/invite-route-mount.tsx",
  "app/(shell)/layout.tsx",
  "app/(shell)/shell-layout-client.tsx",
  "app/(shell)/account/page.tsx",
  "app/(shell)/dashboard/dashboard-live-mount.tsx",
  "app/(shell)/dashboard/page.tsx",
  "app/api/account/route.ts",
  "app/api/notifications/route.ts",
  "app/api/cron/keepalive/route.ts",
  "app/api/invitations/_dependencies.ts",
  "app/api/invitations/[invitationId]/route.ts",
  "app/api/invitations/[invitationId]/accept/route.ts",
  "app/api/invitations/[invitationId]/register/route.ts",
  "app/api/organizations/route.ts",
  "app/api/organizations/[id]/route.ts",
  "app/api/organizations/[id]/invitations/route.ts",
  "app/api/organizations/[id]/invitations/[invitationId]/route.ts",
  "app/auth/callback/route.ts",
  "app/auth/cleanup/route.ts",
  "app/layout.tsx",
  "config/env.ts",
  "config/shell.overrides.ts",
];

export const APP_DEPENDENCY_DEFAULTS = {
  "@brightweblabs/app-shell": "^0.14.4",
  "@brightweblabs/core-auth": "^0.10.8",
  "@brightweblabs/infra": "^0.7.0",
  "@brightweblabs/module-admin": "^0.8.17",
  "@brightweblabs/module-crm": "^0.15.17",
  "@brightweblabs/module-marketing": "^0.4.12",
  "@brightweblabs/module-orgs": "^0.4.12",
  "@brightweblabs/module-projects": "^0.16.5",
  "@brightweblabs/theme": "^0.8.1",
  "@brightweblabs/ui": "^1.5.0",
  "geist": "1.7.2",
  "lucide-react": "^1.8.0",
  "next": "^16.0.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
};

export const SITE_DEPENDENCY_DEFAULTS = {
  "geist": "1.7.2",
  "next": "^16.0.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
};

export const APP_DEV_DEPENDENCY_DEFAULTS = {
  "@types/node": "^20",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "typescript": "^5",
};

export const SITE_DEV_DEPENDENCY_DEFAULTS = {
  "@tailwindcss/postcss": "^4",
  "@types/node": "^20",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "tailwindcss": "^4",
  "typescript": "^5",
};

export const DEFAULTS = {
  productNameSuffix: "Platform",
  tagline: "A configurable Brightweb starter app for new client instances.",
  contactEmail: "hello@example.com",
  supportEmail: "support@example.com",
};

export const HELP_TEXT = `
Usage:
  create-bw-app [options]
  create-bw-app update [options]

Scaffold options:
  --template <platform|site>    Scaffold a platform app or a standalone site
  --name, --slug <name>          Project name and default directory name
  --modules <list>               Comma-separated modules: crm,marketing,projects,admin
  --output-dir <path>            Parent folder for the generated app
  --target-dir <path>            Exact output directory, bypassing slug folder creation
  --workspace-root <path>        BrightWeb workspace root for local mode
  --dependency-mode <mode>       "workspace" or "published"
  --supabase-region <region>      Supabase project region used to place Vercel Functions
  --install                      Install dependencies after scaffolding
  --no-install                   Skip dependency installation
  --yes                          Accept defaults for any missing optional prompt
  --dry-run                      Print planned actions without writing files
  --help                         Show this help message

Update options:
  --target-dir <path>            Existing app directory to update (defaults to cwd)
  --workspace-root <path>        BrightWeb workspace root for workspace:* apps
  --package-manager <name>       Override package manager: pnpm, npm, yarn, or bun
  --allow-stale-fallback         Use baked-in BrightWeb package versions if npm lookup fails
  --install                      Run install after writing package changes
  --refresh-starters             Rewrite tracked package mount files from the latest template
  --dry-run                      Print the update plan without writing files
`.trim();
