# Platform Preview

This app is the internal preview and sandbox app for `brightweb-platform`.

Use it to:

- run shared platform packages in one local app
- test new shell, CRM, admin, auth, and projects work before shipping it into a scaffold
- preview extracted package behavior
- validate auth and module wiring without touching a generated client project

This app is not the source of truth for generated apps.

Scaffold ownership lives in:

- `packages/create-bw-app/template/base` for platform apps
- `packages/create-bw-app/template/site/base` for site apps

Recommended commands from the platform repo root:

```bash
pnpm install
pnpm dev
```

For a completely local Docker-backed Supabase stack, keep Docker Desktop
running and use:

```bash
pnpm db:local:start
pnpm db:local:seed
pnpm dev:local
```

The local wrapper injects the CLI database credentials into the preview process
and disables email delivery. It does not edit or consume the remote Supabase
credentials in `.env.local`. The development administrator is
`dev@brightweblabs.test` with password `BrightWebDev!36`.

After changing migrations, rebuild and reset only the disposable local database:

```bash
pnpm db:local:reset
pnpm db:local:seed
```

Stop the local services with `pnpm db:local:stop`.

Current preview routes:

- `/`
- `/bootstrap`
- `/preview/app-shell`
- `/login`
- `/admin` (redirects to the packaged `/admin/users` surface)
- `/dashboard`
- `/crm`
- `/crm/report`
- `/projects`
- `/projects/[id]`
- `/projects/[id]/board`
- `/projects/[id]/tasks`

Preview app config files:

- `config/brand.ts`
- `config/modules.ts`
- `config/env.ts`
- `.env.local` when local service values are needed
