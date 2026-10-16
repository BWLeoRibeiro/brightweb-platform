---
"create-bw-app": patch
---

Reconcile pnpm lockfiles during explicit update and upgrade installations in CI, where an existing lockfile otherwise defaults to frozen mode after dependency inputs change. Keep ordinary and scaffold installation policy unchanged.
