---
"create-bw-app": patch
---

Preserve scaffold baselines and explicit ownership across module addition, removal and upgrade, including overlapping config routes. Returning a file to management now records its canonical template baseline. Legacy update respects owned and skipped files while retaining explicit starter refresh behavior. Reject untracked module overlay collisions before writing application files.
