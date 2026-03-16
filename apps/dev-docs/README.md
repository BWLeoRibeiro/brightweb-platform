# BrightWeb Internal Docs

Internal Next.js docs app for the BrightWeb Stack markdown in the repo.

## Local run

From the workspace root:

```bash
pnpm install
pnpm dev:docs
```

Or run the app directly:

```bash
pnpm --filter dev-docs dev
```

Build and start the production app locally:

```bash
pnpm build:docs
pnpm start:docs
```

## Scope

- renders the public docs source of truth from the root `docs/` folder
- builds navigation from the public docs sections: `foundations`, `modules`, and `recipes`
- intentionally excludes `docs/internal/` from the normal docs app navigation
- shows source-file metadata for each rendered page so repo docs and app docs stay aligned

## Notes

- This app is a documentation surface, not the canonical storage location for docs content.
- Maintainer-only runbooks and architecture notes remain in the repo under `docs/internal/`.
