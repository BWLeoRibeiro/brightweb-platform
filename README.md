# Brightweb Platform

Shared platform monorepo for Brightweb client apps.

## Workspace

- `apps/starter-site`: reference Next.js client app
- `packages/*`: shared platform modules
- `supabase/*`: shared database ownership model and migration planning

## Starter app

Run the reference app:

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

Future public commands after npm publish:

```bash
pnpm dlx create-bw-app
npm create bw-app@latest
```

Detailed generator notes:

- [docs/operations/create-bw-app-cli.md](/Users/leoribeiro/Documents/02_Projects/brightweb-platform/docs/operations/create-bw-app-cli.md)

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
