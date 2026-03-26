# Agent Guide

This file is the local routing guide for AI agents working inside a generated BrightWeb platform app.

It is intentionally app-scoped. It explains the generated project you are in, not the maintainer-only BrightWeb monorepo internals.

## Project shape

This app is a normal Next.js App Router project with BrightWeb runtime wiring layered on top.

- `app/`: route tree, layouts, pages, starter previews, and playground routes.
- `components/`: local React components used by starter routes and app-owned product work.
- `config/`: generated app configuration for brand, env readiness, enabled modules, bootstrap content, and shell registration.
- `public/brand/`: starter logos used by the shell lockups.
- `.env.local`: local service configuration for Supabase, Resend, and runtime URLs.

## Fast routing map

- `docs/ai/app-context.json`: machine-readable summary of this app's template, starter routes, and first-read files.
- `docs/ai/examples.md`: common setup and customization workflows.
- `README.md`: first-run setup steps.
- `components/`: local app component layer for starter surfaces and future product UI.
- `config/brand.ts`: client identity, product naming, and contact inboxes.
- `config/modules.ts`: module metadata and enablement flags for CRM, Projects, and Admin.
- `config/client.ts`: aggregated state consumed by starter pages.
- `config/bootstrap.ts`: bootstrap checklist content for `/bootstrap`.
- `config/shell.ts`: app-shell registration and navigation wiring.
- `app/globals.css`: color tokens (raw brand + semantic mappings), typography, and global surface styling.
- `app/page.tsx`: starter landing page for the generated app.
- `app/bootstrap/page.tsx`: setup checklist surface.
- `app/preview/app-shell/page.tsx`: shell preview validation route.
- `app/playground/auth/page.tsx`: auth validation route.
- `app/playground/*`: optional module playgrounds when those modules were selected at scaffold time.

## Editing strategy

- Change client identity first in `config/brand.ts`.
- Change colors and theme tokens in `app/globals.css`.
- Check module presence in `config/modules.ts` before editing or creating module-specific routes.
- Add app-specific UI in `components/` before forking shared package code.
- Use `config/shell.ts` when navigation or toolbar behavior needs to change.
- Use `config/bootstrap.ts` and `config/client.ts` when the setup checklist or readiness messaging is wrong.
- Keep starter validation routes until the real product routes replace their purpose.

## Validation checklist

1. Confirm `.env.local` is populated with real values.
2. Run the app locally.
3. Validate `/`, `/bootstrap`, `/preview/app-shell`, and `/playground/auth`.
4. Validate the playground route for each enabled optional module.
5. If a starter route is removed, also remove any links or config references that still point to it.
