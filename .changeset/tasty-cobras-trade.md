---
"@brightweblabs/infra": minor
"create-bw-app": minor
---

Promote `@brightweblabs/infra/server` as the canonical app-owned Resend transport by adding stable webhook signature verification and retaining typed Resend errors.

Update `create-bw-app` platform scaffolds to:

- generate expanded Resend/marketing environment keys
- include a local `lib/email/resend-base.ts` adapter that re-exports from `@brightweblabs/infra/server`
- scope Resend readiness checks to admin-enabled stacks and require sender/webhook coverage instead of only `RESEND_API_KEY`
