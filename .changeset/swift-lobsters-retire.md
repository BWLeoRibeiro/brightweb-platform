---
"@brightweblabs/infra": patch
"create-bw-app": patch
---

Update Supabase environment variable names to use the new publishable and secret key defaults.

`@brightweblabs/infra` now reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` for browser and SSR clients, rejects `sb_secret_` keys with updated validation messaging, and reads `SUPABASE_SECRET_DEFAULT_KEY` for privileged server access while enforcing the `sb_secret_` prefix.

`create-bw-app` now scaffolds the new Supabase env variable names in starter env requirements, generated `.env.local` files, and starter setup guidance.
