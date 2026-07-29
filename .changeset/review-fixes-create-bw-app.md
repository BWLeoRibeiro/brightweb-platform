---
"create-bw-app": minor
---

Scaffolded apps now render the module toolbar controls and the notifications AlertsMenu in the shell header, matching the platform preview. BREAKING for the CLI: `bw admin create --force` has been removed — the bootstrap RPC is replaced with a two-argument signature that always refuses once an administrator exists; add further administrators through the in-app role controls.
