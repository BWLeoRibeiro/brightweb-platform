---
"create-bw-app": patch
---

Ship a forward Projects migration enforcing that each task's optional milestone belongs to the same project, including direct writes and milestone reassignment. Milestone deletion still unlinks tasks without clearing their required project. Invalid existing relationships stop migration with an aggregate preflight result and require a separately reviewed data remediation.
