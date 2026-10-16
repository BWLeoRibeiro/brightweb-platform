---
"create-bw-app": patch
---

Include the Projects profile page in the tracked starter inventory so upgrades
with `--refresh-starters` restore a missing `/account/perfil` route. Preserve
drifted, app-owned and intentionally skipped pages; refuse untracked custom
profile conflicts before writing app files.
