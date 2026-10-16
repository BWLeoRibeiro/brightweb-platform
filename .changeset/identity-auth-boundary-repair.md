---
"@brightweblabs/module-orgs": patch
"@brightweblabs/module-admin": patch
"create-bw-app": patch
---

Protect profile identity across browser insert, update and upsert; resolve grants from current confirmed Auth identity and recheck it under transaction locks. Require confirmed first-admin setup and fail closed on conflicting identities. Apply Core/Admin/Orgs identity migrations atomically with checked prerequisites, and refuse invitation operations until their required SQL is installed.
