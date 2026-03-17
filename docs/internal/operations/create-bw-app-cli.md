# Create BrightWebLabs CLI

## Background

The earlier local generator lived in:

- `package.json` as `pnpm create:client`
- `scripts/create-brightweb-client.mjs`
- the live preview app as its implicit template source

Capabilities it already had:

- prompted for app slug
- prompted for company name, product name, tagline, contact email, support email, and primary brand color
- prompted module enablement with separate yes/no questions for `crm`, `projects`, and `admin`
- copied the full preview app folder into `apps/<slug>`
- rewrote the generated app `package.json` name
- rewrote the generated app `README.md`
- wrote `.env.local` directly with brand values, service keys, and module flags

Gaps it still had:

- isolate a publishable template inside a package
- generate a package with a real `bin` entry
- support external usage like `pnpm dlx create-bw-app`
- install dependencies
- distinguish workspace dependencies from published npm versions
- make module selection affect actual dependency wiring
- generate `.env.local`
- generate `.gitignore`
- provide CLI help or argument flags

## Current package layout

The new generator now lives in `packages/create-bw-app`.

Why this name:

- it maps directly to `pnpm dlx create-bw-app`
- it also maps to `npm create bw-app`
- it keeps the public npm package name obvious and avoids a second renaming step later

Structure:

```text
packages/create-bw-app/
  bin/
  src/
  template/base/
  template/modules/
  template/site/base/
```

The live preview app now lives separately at `apps/platform-preview`. It is a sandbox for local package work, not the scaffold source for generated apps.

## What the refactor improves

- generator logic is owned by a dedicated workspace package
- the package has a publishable `bin` entry
- the template is isolated from the live preview app
- the CLI now supports two scaffold types:
  - `platform`: auth-first BrightWeb app with optional `crm`, `projects`, and `admin`
  - `site`: standalone Next.js + Tailwind site starter with local UI primitives
- module selection now controls copied module playground files, generated `next.config.ts`, generated `config/shell.ts`, and dependency wiring
- generated apps now get generated config files, `.gitignore`, `README.md`, `package.json`, and `next.config.ts`
- platform apps also get `.env.local` for service values
- generated apps also get `AGENTS.md`, `docs/ai/README.md`, `docs/ai/examples.md`, and `docs/ai/app-context.json` so local coding agents have an app-scoped handoff after scaffold time
- the CLI supports flags, `--help`, and `--dry-run`
- the interactive flow is simplified to app type, project name, template-specific prompts, and install confirmation
- the CLI supports two dependency modes:
  - `workspace`: generates `workspace:*` internal dependencies for repo-local client apps
  - `published`: generates npm-ready internal dependency versions for future external usage

## Current scaffold behavior

| Concern | Current behavior |
| --- | --- |
| Templates | Prompts for either a platform app or a standalone site starter. |
| Modules | For platform apps, prompts for optional modules: CRM, Projects, and Admin. |
| Dependency wiring | Selected modules affect package dependencies, copied module starter files, generated `next.config.ts`, and generated shell/config wiring. |
| Environment scaffold | Platform apps generate `.env.local` for service values, while starter identity and module state live in generated config files. |
| Agent docs | Generated apps copy `AGENTS.md`, `docs/ai/README.md`, `docs/ai/examples.md`, and `docs/ai/app-context.json` into the project for local AI-agent orientation. |
| Install mode | Can install dependencies immediately or skip install during scaffolding. |
| Output location | In normal external usage, the generated app is written to `./<slug>` unless you override the target directory. |

## Workspace usage

In a BrightWeb workspace:

```bash
pnpm create:client
pnpm create:client -- --help
pnpm create:client -- --template site
pnpm create:client -- --name client-portal --modules crm,projects --no-install
```

Workspace behavior:

- target directory defaults to `apps/<slug>`
- internal BrightWeb dependencies are written as `workspace:*`
- the old entrypoint still works through a thin compatibility wrapper

## Future published usage

Once `create-bw-app` is published to npm:

```bash
pnpm dlx create-bw-app
npm create bw-app@latest
```

Published behavior:

- target directory defaults to `./<slug>`
- platform apps write internal BrightWeb dependencies with published semver ranges
- site apps stay standalone and do not depend on internal BrightWeb runtime packages
- the generated app is intended to run as a standalone Next.js project

## Remaining gaps before broader public rollout

- publish `create-bw-app` to npm
- confirm the unscoped npm package name `create-bw-app` is available
- add CI smoke tests that scaffold and build a sample app in both workspace and published modes
- decide how internal package version bumps should automatically update the CLI’s fallback dependency map over time
- decide whether the site template should keep the default Turbopack production build or pin `next build --webpack` until Tailwind/PostCSS validation is covered in CI
