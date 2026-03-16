# create-bw-app

Scaffold a new BrightWeb app from either the `platform` or `site` starter.

## Workspace usage

From the BrightWeb platform repo root:

```bash
pnpm create:client
pnpm create:client -- --help
pnpm create:client -- --template site
```

The workspace wrapper delegates to this package with `workspace:*` dependency wiring and BrightWeb-specific output rules.

## Published usage

Once this package is published to npm:

```bash
pnpm dlx create-bw-app
pnpm dlx create-bw-app --template site
npm create bw-app@latest
```

## Template behavior

- prompts for app type: `platform` or `site`
- prompts for project name
- prompts for optional platform modules: `admin`, `crm`, and `projects`
- prompts to install dependencies immediately
- copies a clean Next.js App Router starter template
- platform apps include BrightWeb auth, shell wiring, and optional module starter surfaces
- site apps include Next.js, Tailwind CSS v4, and local component primitives
- writes `package.json`, `next.config.ts`, `.gitignore`, and `README.md` for both templates
- platform apps also write `.env.example`, generated config files, and module feature flags
- supports repo-local `workspace:*` wiring and future published dependency wiring

## Workspace mode extras

When this package runs in BrightWeb workspace mode, it can:

- write the new app under `apps/<slug>`
- keep internal dependencies on `workspace:*`
- create `supabase/clients/<slug>/stack.json`
- create a client-only migrations folder so database planning stays aligned with scaffolded modules

Platform mode always resolves to the `Core + Admin` database baseline. Selecting `admin` affects the Admin starter UI and package wiring, not whether the Admin database layer exists.

## Related references

- `packages/create-bw-app/src/generator.mjs`
- `packages/create-bw-app/src/constants.mjs`
- `packages/create-bw-app/template/base`
- `packages/create-bw-app/template/site/base`
- `packages/create-bw-app/template/modules`
