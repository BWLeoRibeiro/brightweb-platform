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
    description: "Standalone Next.js + Tailwind site starter with a local UI layer.",
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
  "@brightweblabs/ui",
];

export const BRIGHTWEB_PACKAGE_NAMES = [
  ...CORE_PACKAGES,
  ...SELECTABLE_MODULES.map((moduleDefinition) => moduleDefinition.packageName),
];

export const MODULE_STARTER_FILES = {
  admin: [
    "app/api/admin/users/route.ts",
    "app/api/admin/users/roles/route.ts",
    "app/playground/admin/page.tsx",
  ],
  crm: [
    "app/api/crm/contacts/route.ts",
    "app/api/crm/organizations/route.ts",
    "app/api/crm/owners/route.ts",
    "app/api/crm/stats/route.ts",
    "app/playground/crm/page.tsx",
  ],
  projects: [
    "app/playground/projects/page.tsx",
  ],
};

export const APP_DEPENDENCY_DEFAULTS = {
  "@brightweblabs/app-shell": "^0.3.0",
  "@brightweblabs/core-auth": "^0.3.3",
  "@brightweblabs/infra": "^0.3.0",
  "@brightweblabs/module-admin": "^0.3.2",
  "@brightweblabs/module-crm": "^0.3.3",
  "@brightweblabs/module-projects": "^0.3.2",
  "@brightweblabs/ui": "^0.3.1",
  "lucide-react": "^0.562.0",
  "next": "16.1.6",
  "react": "19.2.3",
  "react-dom": "19.2.3",
};

export const SITE_DEPENDENCY_DEFAULTS = {
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.562.0",
  "next": "16.1.6",
  "react": "19.2.3",
  "react-dom": "19.2.3",
  "tailwind-merge": "^3.4.0",
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
  --modules <list>               Comma-separated modules: crm,projects,admin
  --output-dir <path>            Parent folder for the generated app
  --target-dir <path>            Exact output directory, bypassing slug folder creation
  --workspace-root <path>        BrightWeb workspace root for local mode
  --dependency-mode <mode>       "workspace" or "published"
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
  --refresh-starters             Rewrite starter route files from the latest template
  --dry-run                      Print the update plan without writing files
`.trim();
