---
"@brightweblabs/module-projects": patch
---

Route project activity logging through `@brightweblabs/infra/server` `createServiceRoleClient()` so the module no longer directly reads legacy Supabase service-role environment variable names.
