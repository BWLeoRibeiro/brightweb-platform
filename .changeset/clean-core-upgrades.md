---
"create-bw-app": patch
---

Include core migrations during full `bw upgrade` runs even though core is represented by the migration cursor rather than the optional module map.
