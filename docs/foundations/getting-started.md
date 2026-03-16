# Getting Started

`create-bw-app` is the BrightWeb app scaffold. It creates either a platform app or a standalone site, and the intended external entrypoint is `pnpm dlx create-bw-app` or `npm create bw-app@latest`.

> The generator scaffolds app structure, package wiring, and starter files. Inside this monorepo, the repo-local wrapper `pnpm create:client` forwards to the same generator in workspace mode and also creates `supabase/clients/<slug>/stack.json` plus a client-only migrations folder so the selected app modules and database plan stay aligned.

## Use the CLI

```bash
pnpm dlx create-bw-app
pnpm dlx create-bw-app --help
pnpm dlx create-bw-app --template site
pnpm dlx create-bw-app --name client-portal --modules crm,projects --no-install
npm create bw-app@latest -- --template site
```

> Contributors can still run `pnpm create:client` from the workspace root. That command is a compatibility wrapper around the same CLI and should not be treated as the primary docs entrypoint.

## What gets scaffolded today

- For both templates: `package.json`, `next.config.ts`, `.gitignore`, and `README.md`.
- For platform apps: `.env.example`, `.env.local`, base config files, and optional module playground wiring.
- For site apps: a lighter standalone Next.js + Tailwind starter with local UI primitives and no BrightWeb runtime package coupling.
- In published usage: internal BrightWeb packages are written as npm semver dependencies instead of `workspace:*`.
- In workspace mode: the repo adds `apps/<slug>`, writes internal dependencies as `workspace:*`, and creates the matching client stack files under `supabase/clients/<slug>`.

## What `create-bw-app` actually does

| Concern | Current behavior |
| --- | --- |
| Templates | Prompts for either a platform app or a standalone site starter. |
| Modules | For platform apps, prompts for optional modules: CRM, Projects, and Admin. |
| Dependency wiring | Selected modules affect package dependencies, copied module starter files, generated `next.config.ts`, and generated shell/config wiring. |
| Install mode | Can install dependencies immediately or skip install during scaffolding. |
| Output location | In normal external usage, the generated app is written to `./<slug>` unless you override the target directory. |
| Database alignment | In workspace mode, it also creates `supabase/clients/<slug>/stack.json` and a client-only migrations folder for the new client stack. |

## High-level setup flow

1. From the parent directory where you want the new app to live, run `pnpm dlx create-bw-app` and choose the template.
2. If creating a platform app, choose optional modules based on the product scope.
3. Change into the generated app directory and install dependencies if you skipped install during scaffolding.
4. Review `.env.example` and fill `.env.local` with real credentials.
5. Run the app from the generated project with `pnpm dev`.

> Workspace-only follow-up: if you generate the app inside this monorepo, use `pnpm db:plan <slug>` and `pnpm db:materialize <slug>` when you need the effective Supabase workdir for the client stack, then run it with `pnpm --filter <slug> dev`.

> Platform vs site matters: the platform template is the authenticated BrightWeb app shell with optional business modules. The site template is a standalone marketing-style starter. Do not assume the site template carries platform auth, shell, or module behavior.

## Related docs

- [Platform Base](./platform-base.md)
- [Modules](../modules/README.md)
- [Operations: Create BrightWebLabs CLI](../operations/create-bw-app-cli.md)

## Repo sources

- `README.md`
- `docs/operations/create-bw-app-cli.md`
- `packages/create-bw-app/src/generator.mjs`
- `packages/create-bw-app/src/constants.mjs`
- `packages/create-bw-app/README.md`
