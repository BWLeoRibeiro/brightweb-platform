---
"create-bw-app": patch
---

Warn when preserved app-owned scaffold files have unreconciled upstream template changes, including shells that still match an older baseline. Explicitly report that live database objects, applied migrations and authenticated permissions are not verified by local doctor checks.

Track the projects client profile route in the starter inventory so existing apps can restore `/account/perfil` with `bw upgrade projects --refresh-starters`.
