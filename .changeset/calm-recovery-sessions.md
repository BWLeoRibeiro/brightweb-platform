---
"@brightweblabs/core-auth": patch
"@brightweblabs/infra": patch
---

Keep password-recovery code exchange authoritative in the reset page by disabling Supabase's competing automatic browser exchange, preventing false expired-link messages without accepting unrelated signed-in sessions.
