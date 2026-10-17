# Brightweb Platform

BrightWeb's platform source monorepo. This repo owns the shared packages, the scaffold generator, the internal smoke apps, and the shared Supabase module sources used by generated client projects.

## Workspace map

- `apps/platform-preview`: internal smoke app for validating package integration, not the source of truth for generated projects
- `apps/dev-docs`: internal docs app that renders the public docs from the root `docs/` folder
- `packages/*`: shared BrightWeb runtime, UI, and module packages
- `packages/create-bw-app`: publishable scaffold CLI plus the canonical platform and site templates
- `supabase/*`: shared database module ownership, client stack plans, and materialization scripts
- `docs/`: public product and scaffold docs
- `docs/internal/`: maintainer-only architecture notes and operational runbooks that stay in the repo

The long-lived apps in this repo are the internal smoke and docs surfaces. Generated client apps are scaffold outputs, not primary repo apps, and they own their own runtime and database assembly.

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
- `docs/modules`: platform base behavior plus Admin, Organizations, CRM, Marketing, and Projects module boundaries
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
- `apps/platform-preview`: smoke app for package behavior, not the source of truth for generated apps

Current scaffold behavior:

- prompts for `platform` or `site`
- prompts for the project name
- supports optional platform module selection for `admin`, `crm`, `marketing`, and `projects`
- writes `package.json`, `next.config.ts`, `.gitignore`, and `README.md` for both templates
- writes `.env.local`, shell wiring, and module flags for platform apps
- keeps repo-local generated apps on `workspace:*` dependencies in workspace mode

In workspace mode the generator creates the app under `apps/<slug>`. For platform apps it also creates `supabase/clients/<slug>/stack.json` plus a client-only migrations folder so the database install plan stays aligned with the selected modules.

Platform mode always resolves to the `Core + Admin` database baseline. Selecting `admin` only controls whether the Admin starter UI and package wiring are scaffolded.

Published usage:

```bash
pnpm dlx create-bw-app
npm create bw-app@latest
```

Maintainer notes for the generator live in [docs/internal/operations/create-bw-app-cli.md](/Users/leoribeiro/Documents/02_Projects/brightweb-platform/docs/internal/operations/create-bw-app-cli.md).

## Database modules

This repo owns shared module migrations and database authoring helpers. Generated client projects own their own database assembly.

Legacy compatibility commands that still exist in this repo:

```bash
pnpm db:plan acme
pnpm db:materialize acme
```

`db:materialize` is deprecated. It only exists as a workspace compatibility step for older BrightWeb flows and should not be treated as the normal product workflow.

Other common database commands:

```bash
pnpm db:new core profile_notification_cursor
pnpm db:new client:acme bespoke_reporting_table
```

The shared registry lives in `supabase/module-registry.json`. Client-specific plans live under `supabase/clients/<slug>`.

## Publishing

This repo publishes the `@brightweblabs/*` packages and the unscoped `create-bw-app` CLI.

Release flow:

1. Add a changeset with the package change using `pnpm changeset`, then open a feature PR.
2. Merge the feature PR after CI passes. Successful main CI triggers `.github/workflows/release.yml`, which creates or updates the automated version PR.
3. Review and merge the version PR after its checks pass. The release workflow publishes only after CI succeeds for that versioned commit and confirms it is still current main.

Changesets runs `pnpm release:version` inside the version PR workflow. This also synchronizes `brightweb-release.json` and the generated app dependency defaults.

Because the current packages publish TypeScript source, consuming Next.js apps should keep the relevant `transpilePackages` entries for the `@brightweblabs/*` packages they install.

Publishing requires:

1. npm ownership or publish access for the scoped packages and `create-bw-app`.
2. A trusted publisher configured for each npm package, authorizing this GitHub repository and the `release.yml` workflow.
3. The existing workflow's `id-token: write` permission and GitHub-hosted runner for OIDC authentication. The normal release does not require an `NPM_TOKEN` secret.
4. Passing CI and the Changesets version PR flow above.

See [npm Publishing Setup](docs/internal/operations/npm-publishing.md) for the trusted-publisher configuration and manual-release policy.
