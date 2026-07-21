---
"@brightweblabs/infra": patch
"@brightweblabs/core-auth": patch
"@brightweblabs/module-crm": patch
"@brightweblabs/module-orgs": patch
"@brightweblabs/module-projects": patch
---

Align Supabase SSR and the shared Supabase client dependency across infrastructure, auth, and domain packages to avoid duplicate cookie implementations and incompatible client types.
