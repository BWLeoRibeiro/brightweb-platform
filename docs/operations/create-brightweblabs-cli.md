# Create BrightWebLabs CLI

## Audit of the old generator

The old local generator lived in:

- `package.json` as `pnpm create:client`
- `scripts/create-brightweb-client.mjs`
- `apps/starter-site` as its implicit template source

What it already did:

- prompted for app slug
- prompted for company name, product name, tagline, contact email, support email, and primary brand color
- prompted module enablement with separate yes/no questions for `crm`, `projects`, and `admin`
- copied the full `apps/starter-site` folder into `apps/<slug>`
- rewrote the generated app `package.json` name
- rewrote the generated app `README.md`
- generated `.env.local` with brand values, service keys, and module flags

What it did not do:

- isolate a publishable template inside a package
- generate a package with a real `bin` entry
- support external usage like `pnpm dlx create-brightweblabs`
- install dependencies
- distinguish workspace dependencies from published npm versions
- make module selection affect actual dependency wiring
- generate `.env.example`
- generate `.gitignore`
- provide CLI help or argument flags

## Current package layout

The new generator now lives in `packages/create-brightweblabs`.

Why this name:

- it maps directly to `pnpm dlx create-brightweblabs`
- it also maps to `npm create brightweblabs`
- it keeps the public npm package name obvious and avoids a second renaming step later

Structure:

```text
packages/create-brightweblabs/
  bin/
  src/
  template/base/
  template/modules/
  template/site/base/
```

## What the refactor improves

- generator logic is owned by a dedicated workspace package
- the package has a publishable `bin` entry
- the template is isolated from the live starter app
- the CLI now supports two scaffold types:
  - `platform`: auth-first BrightWeb app with optional `crm`, `projects`, and `admin`
  - `site`: standalone Next.js + Tailwind site starter with local UI primitives
- module selection now controls copied module playground files, generated `next.config.ts`, generated `config/shell.ts`, and dependency wiring
- generated apps now get `.env.example`, `.env.local`, `.gitignore`, `README.md`, `package.json`, and `next.config.ts`
- the CLI supports flags, `--help`, and `--dry-run`
- the interactive flow is simplified to app type, project name, template-specific prompts, and install confirmation
- the CLI supports two dependency modes:
  - `workspace`: generates `workspace:*` internal dependencies for repo-local client apps
  - `published`: generates npm-ready internal dependency versions for future external usage

## Local usage

Inside this repo:

```bash
pnpm create:client
pnpm create:client -- --help
pnpm create:client -- --template site
pnpm create:client -- --name client-portal --modules crm,projects --no-install
```

Local repo behavior:

- target directory defaults to `apps/<slug>`
- internal BrightWeb dependencies are written as `workspace:*`
- the old entrypoint still works through a thin compatibility wrapper

## Future published usage

Once `create-brightweblabs` is published to npm:

```bash
pnpm dlx create-brightweblabs
npm create brightweblabs@latest
```

Published behavior:

- target directory defaults to `./<slug>`
- platform apps write internal BrightWeb dependencies with published semver ranges
- site apps stay standalone and do not depend on internal BrightWeb runtime packages
- the generated app is intended to run as a standalone Next.js project

## Remaining gaps before true public rollout

- publish `create-brightweblabs` to npm
- confirm the unscoped npm package name `create-brightweblabs` is available
- add CI smoke tests that scaffold and build a sample app in both workspace and published modes
- decide how internal package version bumps should automatically update the CLI’s fallback dependency map over time
- decide whether the site template should keep the default Turbopack production build or pin `next build --webpack` until Tailwind/PostCSS validation is covered in CI
