# create-bw-app

Scaffold a new BrightWeb app from either the `platform` or `site` starter.

The CLI can also update an existing generated platform app in place.

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
pnpm dlx create-bw-app update
npm create bw-app@latest
```

## Update existing apps

Run the updater from an existing generated app directory, or point it at one with `--target-dir`:

```bash
pnpm dlx create-bw-app update
pnpm dlx create-bw-app update --dry-run
pnpm dlx create-bw-app update --refresh-starters
pnpm dlx create-bw-app update --target-dir ./apps/client-portal
```

Current updater behavior:

- updates installed `@brightweblabs/*` packages only
- in published mode, resolves those `@brightweblabs/*` target versions from npm at update time
- fails the update if npm resolution fails unless you pass `--allow-stale-fallback`
- re-syncs managed BrightWeb config files such as `next.config.ts`, `config/modules.ts`, and `config/shell.ts`
- reports missing or drifted starter files and only rewrites them with `--refresh-starters`
- prints the follow-up install command unless `--install` is passed
- preserves unrelated third-party dependencies and app-owned product pages

## Template behavior

- prompts for app type: `platform` or `site`
- prompts for project name
- prompts for optional platform modules: `admin`, `crm`, and `projects`
- prompts to install dependencies immediately
- copies a clean Next.js App Router starter template
- platform apps include BrightWeb auth, shell wiring, and optional module starter surfaces
- platform apps include a local `components/` folder for app-owned UI alongside the shared BrightWeb packages
- platform apps in published mode also write `supabase/module-registry.json`, `supabase/clients/<slug>/stack.json`, and the resolved shared SQL migrations under `supabase/modules/<module>/migrations`
- site apps include Next.js, Tailwind CSS v4, and local component primitives
- writes `package.json`, `next.config.ts`, `.gitignore`, and `README.md` for both templates
- platform apps also write `.env.local`, `AGENTS.md`, `docs/ai/README.md`, `docs/ai/examples.md`, `docs/ai/app-context.json`, and generated config files for brand and module state
- site apps also write `AGENTS.md`, `docs/ai/README.md`, `docs/ai/examples.md`, and `docs/ai/app-context.json` for app-local AI handoff
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
- `packages/create-bw-app/template/supabase`
