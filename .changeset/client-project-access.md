---
"@brightweblabs/app-shell": minor
"@brightweblabs/core-auth": minor
"@brightweblabs/module-admin": patch
"@brightweblabs/module-crm": patch
"@brightweblabs/module-projects": minor
"@brightweblabs/theme": patch
"create-bw-app": minor
---

Add atomic project setup with participating organizations, internal teams, and explicit organization or selected-client access; introduce narrow client-safe project APIs, client-facing content fields, paused lifecycle support, client-visible metas, and staff-only internal project boundaries. Client-visible metas are now the single source of truth for current and upcoming work, with bounded previews shipped at the non-destructive compatibility boundary before the separate free-text client-next-steps field is removed. Role changes now surface project reassignment requirements cleanly. Add module-scoped migration cutoffs and hold marked destructive migrations during ordinary `bw upgrade`; cleanup now requires the explicit `--include-destructive-migrations` opt-in after the fail-closed enforcement boundary is deployed.
