---
"create-bw-app": patch
---

Allow module upgrades and additions to append migrations in the containing workspace’s canonical Supabase directory. Keep app writes bounded to the app and reject migration writes outside the nearest workspace/repository boundary or through symlinks.
