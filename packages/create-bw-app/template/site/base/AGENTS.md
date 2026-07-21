# AGENTS.md

This is a thin BrightWeb site shell. It intentionally ships no feature page or local component library.

## Working rules

- Keep site identity in `config/site.ts` and theme values in `app/globals.css`.
- Add routes only as direct mounts of package-owned surfaces.
- Do not add demos, feature components, hooks, data access, or helper libraries to the scaffold layer.
- Build reusable site UI in a package, then mount its export here.

Run the build after changing settings, theme files, or package mounts.
