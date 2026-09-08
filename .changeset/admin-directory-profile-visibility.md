---
"create-bw-app": patch
---

Ship an idempotent admin migration granting authenticated administrators the profile reads required by the shared user directory. Existing consumers receive the forward migration through `bw upgrade`; apply it to their database to restore directory visibility without expanding staff or client access.
