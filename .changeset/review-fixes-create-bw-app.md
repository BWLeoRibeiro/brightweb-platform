---
"create-bw-app": minor
---

Scaffolded apps now render only the selected modules' toolbar controls plus the notifications AlertsMenu in the shell header, matching the platform preview without importing uninstalled modules. Module add, remove, and update operations keep that generated toolbar wiring synchronized. BREAKING for the CLI: `bw admin create --force` has been removed — the bootstrap RPC is replaced with a two-argument signature that always refuses once an administrator exists; add further administrators through the in-app role controls.
