# AGENTS.md

This generated project is a BrightWeb platform starter. Use this file as the local entrypoint for AI agents working inside the app.

## Start here

- `README.md`: local setup commands and starter routes.
- `docs/ai/README.md`: app-specific routing guide for agents.
- `docs/ai/examples.md`: common setup and customization flows.
- `docs/ai/app-context.json`: machine-readable app summary for quick discovery.
- `config/brand.ts`: client identity, naming, and contact defaults.
- `config/modules.ts`: selected module set and runtime enablement.
- `config/client.ts`: starter-facing derived state used by the home page and setup surfaces.
- `.env.local`: runtime service values for local development.

## Working rules

- Treat `/bootstrap`, `/preview/app-shell`, and `/playground/*` as starter validation surfaces. They are app-owned and can be removed after setup if links and references are cleaned up too.
- Check `config/modules.ts` before assuming CRM, Projects, or Admin routes exist.
- Prefer composing app-level routes and config before forking logic from `@brightweblabs/*` packages.
- Keep edits local to this app unless the change is intentionally shared across multiple BrightWeb projects.

## First validation pass

1. Run the local dev server from this project or workspace.
2. Open `/`, `/bootstrap`, `/preview/app-shell`, and `/playground/auth`.
3. If optional modules are enabled, open the matching `/playground/*` route for each one.
4. Confirm `.env.local` contains real service values before debugging runtime behavior.
