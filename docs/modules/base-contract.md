# BrightWeb Base Contract

BrightWeb ships a **base contract** for fast project starts. This page defines what that phrase means and how to treat the current support tiers.

The canonical full manifest lives in [base-contract.json](./base-contract.json). If you want to load only the relevant contract slice, start with [base-contract/index.json](./base-contract/index.json) and then open the module-specific JSON file you need. Use [Using BrightWeb Modules](./using-modules.md) when you need the practical integration patterns in a generated app.

Each manifest entry uses structured fields for `inputs`, `outputs`, and, where relevant, `http` request and response details. That makes the split JSON files the best entrypoint for AI agents and for engineers who only need one module slice at a time.

## Support tiers

| Tier | What it means | What to do with it |
| --- | --- | --- |
| `stable` | Supported base surface intended for reuse across projects. | Build on it. |
| `starter` | Convenience surface tied to starter pages, starter routes, or starter payload shapes. | Feel free to replace or compose it. |
| `internal` | Exported or repo-visible surface that is not part of the supported public promise. | Do not depend on it. |

## Contract shape

The current base contract spans:

- shared and server package helpers
- client hooks
- package-owned route handlers
- shell registration objects
- starter page helpers that prove the module is wired

It is broader than just HTTP endpoints, and narrower than a full developer platform reference portal.

## How To Build On It

- Build new project code on `stable` entries first.
- Use `starter` entries when you want to move quickly, then replace or wrap them as the client app becomes more specific.
- Avoid coupling app-owned code to `internal` entries, even if they are exported today.

## What To Read Next

- Start with [base-contract/index.json](./base-contract/index.json) if you want the split inventory.
- Open [base-contract/platform-base.json](./base-contract/platform-base.json), [base-contract/admin.json](./base-contract/admin.json), [base-contract/crm.json](./base-contract/crm.json), or [base-contract/projects.json](./base-contract/projects.json) when you only need one module slice.
- Use [base-contract.json](./base-contract.json) when you want the full inventory in one file.
- Read [Using BrightWeb Modules](./using-modules.md) for shell wiring, route mounting, and starter integration patterns.
- Read [Platform Base](./platform-base.md), [CRM](./crm.md), and [Projects](./projects.md) for module-specific boundaries and extension guidance.

This page is intentionally short. It defines the contract model; the other pages explain how to use it.
