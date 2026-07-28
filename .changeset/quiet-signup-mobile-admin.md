---
"@brightweblabs/app-shell": patch
"@brightweblabs/core-auth": patch
"create-bw-app": patch
---

Expose the configured admin destination in the mobile shell, return a real 404
from legacy invite-only signup mounts, and stop scaffolding the unavailable
signup route in new invite-only apps.
