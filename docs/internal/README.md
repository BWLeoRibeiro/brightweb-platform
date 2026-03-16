# Internal Docs

This subtree is for maintainer-facing documentation that should stay in the repo but should not be part of the normal public docs surface.

The `apps/dev-docs` navigation intentionally excludes `docs/internal/`. Treat this folder as repo-readable documentation for maintainers, not as public product documentation.

## Areas

- [Internal architecture](./architecture/README.md)
- [Workspace Mode and Database Alignment](./create-an-app-workspace-mode.md)
- [Project Structure Maintainer Notes](./project-structure-maintainer-notes.md)
- [Internal agent index](./agent-index.md)
- [Internal operations](./operations/README.md)

## Rules

- Do not put secrets here.
- Do put sensitive workflow details here when they should stay out of the public docs app and public docs navigation.
- If a page only matters to maintainers, prefer this subtree over the public sections.
