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
    envKey: "NEXT_PUBLIC_ENABLE_CRM",
  },
  {
    key: "projects",
    label: "Projects",
    packageName: "@brightweblabs/module-projects",
    templateFolder: "projects",
    envKey: "NEXT_PUBLIC_ENABLE_PROJECTS",
  },
  {
    key: "admin",
    label: "Admin",
    packageName: "@brightweblabs/module-admin",
    templateFolder: "admin",
    envKey: "NEXT_PUBLIC_ENABLE_ADMIN",
  },
];

export const CORE_PACKAGES = [
  "@brightweblabs/app-shell",
  "@brightweblabs/core-auth",
  "@brightweblabs/infra",
  "@brightweblabs/ui",
];

export const APP_DEPENDENCY_DEFAULTS = {
  "@brightweblabs/app-shell": "^0.1.1",
  "@brightweblabs/core-auth": "^0.1.1",
  "@brightweblabs/infra": "^0.1.0",
  "@brightweblabs/module-admin": "^0.1.1",
  "@brightweblabs/module-crm": "^0.1.1",
  "@brightweblabs/module-projects": "^0.1.1",
  "@brightweblabs/ui": "^0.1.0",
  "lucide-react": "^0.562.0",
  "next": "16.1.1",
  "react": "19.2.3",
  "react-dom": "19.2.3",
};

export const SITE_DEPENDENCY_DEFAULTS = {
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.562.0",
  "next": "16.1.1",
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
  "@tailwindcss/postcss": "^4.0.0",
  "@types/node": "^20",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "postcss": "^8.4.31",
  "tailwindcss": "^4.0.0",
  "typescript": "^5",
};

export const DEFAULTS = {
  productNameSuffix: "Platform",
  tagline: "A configurable Brightweb starter app for new client instances.",
  contactEmail: "hello@example.com",
  supportEmail: "support@example.com",
  primaryHex: "#1f7a45",
};

export const HELP_TEXT = `
Usage:
  create-bw-app [options]

Options:
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
`.trim();
