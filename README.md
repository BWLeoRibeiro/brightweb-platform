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

## Create a new client app

Scaffold a new app from the starter template:

```bash
pnpm create:client
```

The installer will ask for:

- app slug
- company name
- product name
- tagline
- support emails
- brand color
- which modules to enable

It creates a new app under `apps/<slug>` and writes a starter `.env.local` for that client.

## Public npm publishing

This repo is prepared for public npm publishing of the `@brightweblabs/*` packages.

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
