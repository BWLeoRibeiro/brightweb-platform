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

Current preview routes:

- `/`
- `/bootstrap`
- `/preview/app-shell`
- `/playground/auth`
- `/playground/admin`
- `/playground/crm`
- `/playground/projects`

Preview app config files:

- `config/brand.ts`
- `config/modules.ts`
- `config/env.ts`
- `.env.example`
