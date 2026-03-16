# Brightweb Platform

BrightWeb's platform source monorepo. This repo owns the internal preview apps, the shared packages, the scaffold generator, and the Supabase module planning model used to create client applications.

## Workspace map

- `apps/platform-preview`: internal sandbox app for validating shell, auth, admin, CRM, and projects behavior
- `apps/dev-docs`: internal docs app that renders the public docs from the root `docs/` folder
- `packages/*`: shared BrightWeb runtime, UI, and module packages
- `packages/create-bw-app`: publishable scaffold CLI plus the canonical platform and site templates
- `supabase/*`: shared database module ownership, client stack plans, and materialization scripts
- `docs/`: public product and scaffold docs
- `docs/internal/`: maintainer-only architecture notes and operational runbooks that stay in the repo

The long-lived apps in this repo are the internal preview and docs surfaces. Generated client apps are scaffold outputs, not primary repo apps.

## Common commands

Run the internal preview app:

```bash
pnpm dev
```

Run the internal docs app:

```bash
pnpm dev:docs
```

Build the internal apps:

```bash
pnpm build
pnpm build:docs
```

## Documentation map

Public docs live under `docs/` and are organized into:

- `docs/foundations`: install flow, template choice, and generated project structure
- `docs/modules`: platform base behavior plus CRM and Projects module boundaries
- `docs/recipes`: practical workflows and manual follow-up tasks

Maintainer-only notes live under `docs/internal/` and are intentionally excluded from the normal docs app navigation.

## Create a new app

Scaffold either a platform app or a standalone site:

```bash
pnpm create:client
pnpm create:client -- --help
pnpm create:client -- --template site
```

The workspace wrapper delegates to the publishable CLI package in `packages/create-bw-app`.

Template ownership is intentionally separate from the preview app:

- `packages/create-bw-app/template/base`: canonical platform-app scaffold
- `packages/create-bw-app/template/site/base`: canonical standalone site scaffold
- `packages/create-bw-app/template/modules/*`: optional module template overlays
- `apps/platform-preview`: sandbox for package behavior, not the source of truth for generated apps

Current scaffold behavior:

- prompts for `platform` or `site`
- prompts for the project name
- supports optional platform module selection for `admin`, `crm`, and `projects`
- writes `package.json`, `next.config.ts`, `.gitignore`, and `README.md` for both templates
- writes `.env.example`, shell wiring, and module flags for platform apps
- keeps repo-local generated apps on `workspace:*` dependencies in workspace mode

In workspace mode the generator creates the app under `apps/<slug>`. For platform apps it also creates `supabase/clients/<slug>/stack.json` plus a client-only migrations folder so the database install plan stays aligned with the selected modules.

Platform mode always resolves to the `Core + Admin` database baseline. Selecting `admin` only controls whether the Admin starter UI and package wiring are scaffolded.

Published usage after npm release:

```bash
pnpm dlx create-bw-app
npm create bw-app@latest
```

Maintainer notes for the generator live in [docs/internal/operations/create-bw-app-cli.md](/Users/leoribeiro/Documents/02_Projects/brightweb-platform/docs/internal/operations/create-bw-app-cli.md).

## Database modules

Plan or materialize the database install order for a client stack:

```bash
pnpm db:plan acme
pnpm db:materialize acme
```

Other common database commands:

```bash
pnpm db:new core profile_notification_cursor
pnpm db:new client:acme bespoke_reporting_table
```

The shared registry lives in `supabase/module-registry.json`. Client-specific plans live under `supabase/clients/<slug>`.

## Publishing

This repo is prepared to publish the `@brightweblabs/*` packages and the unscoped `create-bw-app` CLI.

Release flow:

```bash
pnpm changeset
pnpm release:version
pnpm install
git add .
git commit -m "Version packages"
git push
```

GitHub Actions then publishes packages from `main` when the release PR lands.

Because the current packages publish TypeScript source, consuming Next.js apps should keep the relevant `transpilePackages` entries for the `@brightweblabs/*` packages they install.

Before the first publish, you still need to:

1. Create or claim the `@brightweblabs` npm scope.
2. Create an npm automation token with publish access.
3. Add `NPM_TOKEN` as a GitHub Actions secret in the repository.
4. Run one initial release with Changesets.
