# Brightweb Platform

Shared platform monorepo for Brightweb client apps.

## Workspace

- `apps/platform-preview`: internal Next.js preview app for platform work
- `packages/*`: shared platform modules
- `supabase/*`: shared database ownership model and migration planning

## Platform preview app

Run the internal preview app:

```bash
pnpm dev
```

## Create a new app

Scaffold either a platform app or a standalone site:

```bash
pnpm create:client
pnpm create:client -- --help
pnpm create:client -- --template site
```

The local wrapper now delegates to the publishable workspace CLI package at `packages/create-bw-app`.

Template ownership is intentionally separate from the preview app:

- `packages/create-bw-app/template/base`: canonical platform-app scaffold
- `packages/create-bw-app/template/site/base`: canonical site scaffold
- `apps/platform-preview`: sandbox for trying shell, CRM, admin, auth, and projects features locally

The installer can:

- ask which app type to create: `platform` or `site`
- ask for the project name
- ask yes/no questions for optional modules when creating a platform app
- ask whether dependencies should be installed immediately
- generate `package.json`, `next.config.ts`, `.gitignore`, and `README.md` for both templates
- generate `.env.example`, `.env.local`, and module wiring for platform apps
- generate a Tailwind-based site starter with local shadcn-style components for site apps
- keep repo-local apps wired to `workspace:*` dependencies

It creates a new app under `apps/<slug>`.

When you scaffold a platform app in workspace mode, the generator also creates
`supabase/clients/<slug>/stack.json` plus a client-only migrations folder so the
database module plan stays aligned with the app modules you selected. The stack
keeps RBAC/admin governance enabled for platform auth even if the admin UI
module is not selected.

Future public commands after npm publish:

```bash
pnpm dlx create-bw-app
npm create bw-app@latest
```

Detailed generator notes:

- [docs/operations/create-bw-app-cli.md](/Users/leoribeiro/Documents/02_Projects/brightweb-platform/docs/operations/create-bw-app-cli.md)

## Database modules

Plan or materialize the database schema for a client stack:

```bash
pnpm db:plan begreen
pnpm db:materialize begreen
```

## Public npm publishing

This repo is prepared for public npm publishing of the `@brightweblabs/*` packages and the unscoped `create-bw-app` CLI.

Release flow:

```bash
pnpm changeset
pnpm release:version
pnpm install
git add .
git commit -m "Version packages"
git push
```

GitHub Actions then publishes packages from `main` when a release PR is merged.

Because the current packages publish TypeScript source, consuming Next.js apps should keep the
`transpilePackages` entries for the `@brightweblabs/*` packages they install.

Before the first publish, you still need to:

1. Create or claim the `@brightweblabs` npm scope.
2. Create an npm automation token with publish access.
3. Add `NPM_TOKEN` as a GitHub Actions secret in the repository.
4. Run one initial release with Changesets.
