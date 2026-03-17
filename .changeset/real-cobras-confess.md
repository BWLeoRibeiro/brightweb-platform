---
"create-bw-app": patch
---

Add AI handoff files to generated apps, including `AGENTS.md`, `docs/ai/README.md`, `docs/ai/examples.md`, and `docs/ai/app-context.json`.

Platform and site starters now get different `app-context.json` shapes so agents receive template-specific guidance instead of one generic schema. The updater also keeps the generated app context file in sync for existing apps.
