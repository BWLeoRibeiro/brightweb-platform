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
