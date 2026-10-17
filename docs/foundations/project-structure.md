# Project Structure

BrightWeb-generated apps are thin integration repositories. They hold environment values, settings, direct package mounts, brand assets, migrations, and local docs—not feature implementations or component libraries.

## Platform app

```text
app/
├── layout.tsx
├── globals.css
├── theme.css
├── crm/page.tsx                  # when CRM is selected
├── marketing/page.tsx            # when Marketing is selected
├── projetos/page.tsx             # when Projects is selected
├── account/projetos/page.tsx     # client-safe Projects account area
├── admin/users/page.tsx          # when Admin is selected
└── api/                          # direct package handler aliases
config/
├── brand.ts
├── modules.ts
├── shell.ts
└── shell.overrides.ts
public/brand/
supabase/
docs/ai/
.brightweb/app-manifest.json
.env.local
next.config.ts
postcss.config.mjs
tsconfig.json
```

CRM, Marketing, Projects, and Admin route files mount package surfaces. Marketing and Projects also contribute complete package-backed API route families; Projects adds staff and client-safe account pages.

## Site app

```text
app/
├── layout.tsx
└── globals.css
config/site.ts
docs/ai/
.brightweb/app-manifest.json
next.config.ts
postcss.config.mjs
tsconfig.json
```

The site template intentionally has no default feature page or local `components/`/`lib/` layer.

## Ownership boundary

| App-owned | Scaffold-managed | Package-owned |
| --- | --- | --- |
| Environment values, identity, enabled modules, shell overrides, theme tokens, brand assets, docs, migrations | Generated shell config, global source scanning, layouts, and direct route mounts | UI surfaces, domain behavior, hooks, state, data access, HTTP handlers, and reusable helpers |

Every generated `route.ts` is a direct package re-export. Pages are direct re-exports or a single imported package component returned from a no-props wrapper.
