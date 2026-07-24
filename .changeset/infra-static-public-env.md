---
"@brightweblabs/infra": patch
---

Reference `NEXT_PUBLIC_SUPABASE_*` variables statically so Next.js/Turbopack inlines them into the client bundle. Dynamic `process.env[name]` access is not statically analyzable and resolved to `undefined` in the browser, breaking client-side auth (login page) with a spurious "missing Supabase env" error.
