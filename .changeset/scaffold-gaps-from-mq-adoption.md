---
"@brightweblabs/theme": minor
"@brightweblabs/infra": minor
"@brightweblabs/module-projects": minor
"@brightweblabs/core-auth": minor
"create-bw-app": minor
---

Close the scaffold gaps found while adopting the CLI for MQ Consulting.

**theme** — the 14 `portal-*` typography utilities moved from
`themes/mq-aliases.css` into `src/typography.css`. 21 source files across
app-shell, module-admin, module-crm, module-projects and module-marketing use
those classes, but they were only defined in a client theme file, so any app not
importing the MQ aliases rendered packaged components with undefined
typography. A client theme must never be load-bearing for package components.
The hygiene guard now scans the base sheet and forbids redefining them in
mq-aliases.

**infra** — new `handleKeepaliveGetRequest`. Free-tier Supabase projects pause
after ~7 days of inactivity; every scaffold now ships `/api/cron/keepalive` for
a scheduler to call with `Authorization: Bearer $SUPABASE_KEEPALIVE_SECRET`.
It runs a real count query, because an HTTP request that never reaches Postgres
does not reset the inactivity timer.

**module-projects** — new `ClientAccountPage` and `ClientProjectDetailRoute`.
The client lens already shipped, but the template never mounted it, so every
scaffolded app silently lacked `/account/projetos` and the account page had no
projects section. These compose the pieces so app routes stay thin re-exports.

**core-auth** — `AuthBrandConfig.splitHeadline` and `splitDescription` widen
from `string` to `ReactNode`, so a brand can emphasise a word inside the auth
headline.

**create-bw-app** — `config/shell.overrides.ts` now exports
`additionalShellModules`, and the generated `config/shell.ts` spreads it.
`applyShellRegistrationOverrides` can only transform registrations that already
exist, so an app-owned surface previously had nowhere to live except
`config/shell.ts` — which `create-bw-app update` overwrites. Also mounts the
client account routes when Projects is enabled, and ships the keepalive route.
