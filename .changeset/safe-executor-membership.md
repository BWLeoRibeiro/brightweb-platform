---
"@brightweblabs/module-projects": patch
---

Refuse client-task migration atomically when any API role is a direct or indirect member of an existing task executor, including SET-only role chains. Existing task data, guards and permissions remain unchanged on refusal; removing the unsafe role grant allows the migration to retry normally.
