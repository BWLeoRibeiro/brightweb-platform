---
"@brightweblabs/module-admin": patch
"@brightweblabs/module-crm": patch
"create-bw-app": patch
---

Reject stale admin invitation revocations without false audit events, and preserve invitations accepted during failed email delivery cleanup. Distinguish permission failures from missing migrations. Remove unused CRM formatting code and redundant private report result wrappers and guards.

The bundled core forward migration restricts the privileged profile identity synchronization function to the service role. Auth triggers continue to run under their owner; existing databases must apply this migration to close anonymous/authenticated direct execution.
