---
"create-bw-app": patch
---

Improve the platform starter structure and CRM route scaffolding.

`create-bw-app` now scaffolds a top-level `components/` folder for app-owned starter UI, updates the generated AI handoff docs and app context to point agents at that layer, and moves the preview and auth playground components out of route folders.

The CRM starter routes also now share a reusable lazy-loaded module route handler helper instead of repeating the same dynamic import wrapper in each route file.
