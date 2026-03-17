# Project Structure

This page is the generated-file map for `create-bw-app`. Read it after [Installation](./installation.md) and [Environment and Services](./environment-and-services.md) when you want to translate the starter into normal Next.js folders, routes, and config files.

<Lead>
Use this page as the generated-file map for <code>create-bw-app</code>. It is intentionally closer to a framework
reference page: start with the top-level folders and files, then scan the template-specific routes.
</Lead>

<Callout title="Generated app scope">
  <p>
    This page describes the <strong>generated client project</strong>, not the internal apps in this repo. The scaffold
    is a standard <strong>Next.js App Router</strong> app, so its <code>app/</code> folder, route segments, layouts,
    and pages follow normal Next.js conventions.
  </p>
  <p>
    In a generated platform app, <code>/bootstrap</code>, <code>/preview/app-shell</code>, and
    <code>/playground/*</code> are starter validation surfaces. You can delete them in the generated project after
    setup if you also remove any links or config references that still point to them.
  </p>
</Callout>

<Callout title="Mental model">
  <p>
    The generator produces one of two Next.js App Router starters. <strong>Platform</strong> adds BrightWeb runtime
    wiring, branding, env scaffolding, and optional module routes. <strong>Site</strong> stays standalone with a local
    UI layer and a lighter config surface.
  </p>
</Callout>

## Folder and file conventions

### Top-level folders

<FactTable
  columns={["Path", "When it exists", "Purpose"]}
  rows={[
    ["`app/`", "platform and site", "Standard Next.js App Router entrypoint for layouts, pages, route segments, previews, and starter routes."],
    ["`config/`", "platform and site", "Generated project configuration. Platform uses multiple runtime config files; site starts with `config/site.ts`."],
    ["`docs/ai/`", "platform and site", "Local agent-facing routing guides, examples, and machine-readable app context for AI assistants working inside the generated app."],
    ["`public/brand/`", "platform only", "Starter logos for the app shell brand lockups and collapsed mark."],
    ["`components/ui/`", "site only", "Local UI primitives for the standalone site starter."],
    ["`lib/`", "site only", "Local helpers such as `lib/utils.ts` for class merging and component ergonomics."],
  ]}
/>

### Top-level files

<FactTable
  columns={["File", "When it exists", "Purpose"]}
  rows={[
    ["`package.json`", "platform and site", "Project manifest with Next.js scripts and template-specific dependencies."],
    ["`next.config.ts`", "platform and site", "Next.js config. Platform also writes `transpilePackages` for BrightWeb runtime packages and selected modules."],
    ["`README.md`", "platform and site", "Generated local setup notes tailored to the chosen template."],
    ["`AGENTS.md`", "platform and site", "Local entrypoint for AI agents with project-specific working rules and starting files."],
    ["`.gitignore`", "platform and site", "Shared ignore rules, including local environment files."],
    ["`next-env.d.ts`", "platform and site", "Standard Next.js TypeScript declarations copied from the template."],
    ["`postcss.config.mjs`", "platform and site", "Tailwind/PostCSS setup copied from the selected starter template."],
    ["`tsconfig.json`", "platform and site", "TypeScript base config copied from the selected starter template."],
    ["`.env.local`", "platform only", "Generated local environment file for service values and runtime overrides."],
    ["`docs/ai/README.md`", "platform and site", "App-scoped routing map for AI agents working on the generated starter."],
    ["`docs/ai/examples.md`", "platform and site", "Common setup and customization workflows for AI agents working in the generated app."],
    ["`docs/ai/app-context.json`", "platform and site", "Machine-readable AI handoff file describing template shape, starter routes, and first-read files."],
    ["`components.json`", "site only", "Local component registry config for the standalone site starter."],
    ["`config/site.ts`", "site only", "Single place to edit site name, description, eyebrow, and starter CTAs."],
    ["`config/brand.ts`", "platform only", "Generated client identity and contact defaults used across the starter app."],
    ["`config/client.ts`", "platform only", "Aggregates starter-facing state for the home page, env readiness, and enabled modules."],
    ["`config/env.ts`", "platform only", "Environment key definitions and readiness checks for the starter platform app."],
    ["`config/modules.ts`", "platform only", "Generated module metadata and runtime enablement based on scaffold selection."],
    ["`config/bootstrap.ts`", "platform only", "Bootstrap checklist content and starter provisioning references."],
    ["`config/shell.ts`", "platform only", "Generated app-shell registration that wires dashboard plus selected module navigation."],
  ]}
/>

## Starter routes

### Shared route surfaces

<FactTable
  columns={["Path", "Template", "Purpose"]}
  rows={[
    ["`/`", "platform and site", "Starter home page."],
    ["`/bootstrap`", "platform", "Bootstrap checklist and setup surface for a new client app."],
    ["`/preview/app-shell`", "platform", "App-shell preview route for validating navigation, branding, and toolbar wiring."],
    ["`/playground/auth`", "platform", "Auth playground for validating the shared platform auth layer."],
    ["`/playground`", "platform", "Nested layout that groups module sandbox routes behind one sidebar."],
  ]}
/>

### Optional module routes

<FactTable
  columns={["Path or file", "Added when selected", "Purpose"]}
  rows={[
    ["`app/playground/crm/page.tsx`", "CRM", "Sandbox route for the CRM module package."],
    ["`app/api/crm/contacts/route.ts`", "CRM", "Starter CRM contacts endpoint backed by the package-owned CRM handler."],
    ["`app/api/crm/organizations/route.ts`", "CRM", "Starter CRM organizations endpoint backed by the package-owned CRM handler."],
    ["`app/api/crm/stats/route.ts`", "CRM", "Starter CRM stats endpoint backed by the package-owned CRM handler."],
    ["`app/api/crm/owners/route.ts`", "CRM", "Starter CRM owner-options endpoint backed by the package-owned CRM handler."],
    ["`app/playground/projects/page.tsx`", "Projects", "Sandbox route for the Projects module package."],
    ["`app/playground/admin/page.tsx`", "Admin", "Sandbox route for the Admin module package."],
    ["`app/api/admin/users/route.ts`", "Admin", "Starter API endpoint included by the admin module template."],
  ]}
/>

## Template layouts at a glance

### Platform app

```text
.
├── app/
│   ├── bootstrap/page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   ├── playground/
│   │   ├── auth/
│   │   │   ├── auth-playground.tsx
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   └── preview/app-shell/page.tsx
├── docs/
│   └── ai/
│       ├── app-context.json
│       ├── examples.md
│       └── README.md
├── config/
│   ├── bootstrap.ts
│   ├── brand.ts
│   ├── client.ts
│   ├── env.ts
│   ├── modules.ts
│   └── shell.ts
├── public/brand/
│   ├── logo-dark.svg
│   ├── logo-light.svg
│   └── logo-mark.svg
├── AGENTS.md
├── .env.local
├── next.config.ts
└── package.json
```

### Site app

```text
.
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── docs/
│   └── ai/
│       ├── app-context.json
│       ├── examples.md
│       └── README.md
├── components/
│   └── ui/
│       ├── badge.tsx
│       ├── button.tsx
│       └── card.tsx
├── config/
│   └── site.ts
├── lib/
│   └── utils.ts
├── AGENTS.md
├── components.json
├── next.config.ts
└── package.json
```

<Callout title="What changes between templates?" tone="success">
  <p>
    Both templates are App Router starters, but the platform starter is opinionated about BrightWeb runtime wiring,
    while the site starter is opinionated about local presentation primitives. That split is reflected directly in the
    generated top-level folders.
  </p>
</Callout>

## How to read this structure

1. If you are generating a <strong>platform</strong> app, start with <code>config/brand.ts</code>, <code>config/modules.ts</code>, and <code>.env.local</code>.
2. If you are generating a <strong>site</strong> app, start with <code>config/site.ts</code>, <code>app/page.tsx</code>, and <code>app/globals.css</code>.

## Related docs

- [Prerequisites](./prerequisites.md)
- [Installation](./installation.md)
- [Environment and Services](./environment-and-services.md)
- [Validate Your Starter](./validate-your-starter.md)
- [Platform Base](../modules/platform-base.md)
