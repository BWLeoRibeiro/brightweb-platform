# AGENTS.md

This generated project is a BrightWeb site starter. Use this file as the local entrypoint for AI agents working inside the app.

## Start here

- `README.md`: local setup commands and the starter surface list.
- `docs/ai/README.md`: app-specific routing guide for agents.
- `docs/ai/examples.md`: common setup and customization flows.
- `docs/ai/app-context.json`: machine-readable app summary for quick discovery.
- `config/site.ts`: site name, description, and starter CTAs.
- `app/page.tsx`: starter landing page composition.
- `app/globals.css`: global design language and theme tokens.

## Working rules

- Treat this starter as app-owned. Prefer editing local routes, sections, and UI primitives instead of introducing shared BrightWeb runtime dependencies.
- Update `config/site.ts` before rewriting copy inline across multiple components.
- Keep reusable UI tweaks inside `components/ui/` when the change should affect multiple sections.

## First validation pass

1. Run the local dev server from this project or workspace.
2. Open `/` and confirm the starter content renders correctly.
3. Check `config/site.ts`, `app/page.tsx`, and `app/globals.css` together before making large copy or layout changes.
