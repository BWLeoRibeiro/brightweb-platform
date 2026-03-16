# BrightWeb Internal Docs

Internal developer documentation app for the BrightWeb platform.

## Local run

From the workspace root:

```bash
pnpm install
pnpm dev:docs
```

Or directly:

```bash
pnpm --filter dev-docs dev
```

## Scope

- renders the root `/docs` folder as the single docs source of truth
- provides app navigation and styling for the same markdown humans can read in the repo
- no auth gate in v1
