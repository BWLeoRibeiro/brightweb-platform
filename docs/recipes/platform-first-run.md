# Platform First Run

Use this after scaffolding a platform app to validate its thin settings-and-mounts contract.

## Steps

1. Review `config/brand.ts`, `config/modules.ts`, and `config/shell.overrides.ts`.
2. Fill `.env.local` with real service values.
3. Install dependencies and run the build.
4. Apply the generated Supabase migrations using your normal deployment flow.
5. Validate `/crm` when CRM is enabled and `/admin/users` when Admin is enabled.
6. For Projects, verify package wiring and migrations; no default route or navigation ships yet.

## Validation checks

- Every generated page and HTTP route is a direct package re-export.
- Enabled package routes either load or return an actionable auth/schema error.
- `config/shell.ts` includes only enabled module registrations.
- The app contains no generated demos, feature components, hooks, or helper libraries.

## Related docs

- [Installation](../foundations/installation.md)
- [Environment and Services](../foundations/environment-and-services.md)
- [Validate Your Starter](../foundations/validate-your-starter.md)
