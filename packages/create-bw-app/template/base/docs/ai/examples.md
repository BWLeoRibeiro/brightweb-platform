# Agent Examples

Use these workflows after reading `AGENTS.md`, `docs/ai/README.md`, and `docs/ai/app-context.json`.

## First local setup

Goal: get the generated starter running with real credentials.

- Review `.env.local` and replace placeholder values.
- Review `config/brand.ts` and confirm client identity.
- Review `config/modules.ts` before touching module routes.
- Run the local dev server for this app or workspace.
- Validate `/`, `/bootstrap`, `/preview/app-shell`, and `/playground/auth`.
- Validate `/playground/crm`, `/playground/projects`, and `/playground/admin` only when those modules are enabled.

## Change brand identity

Goal: update the starter to the real client name and support details.

- Edit `config/brand.ts`.
- Move route-specific presentation into `components/` when the home or preview surfaces need app-owned UI.
- Check `config/client.ts` or `config/bootstrap.ts` if starter copy still references old defaults.
- Validate the home page and `/preview/app-shell` after the change.

## Replace starter routes with product routes

Goal: move from validation surfaces to product-owned pages.

- Build the real routes in `app/` first.
- Keep reusable route UI in `components/` so the app follows the expected Next.js folder split.
- Update `config/shell.ts` if navigation or toolbar behavior changes.
- Remove `/bootstrap`, `/preview/app-shell`, or `/playground/*` only after links and config references are cleaned up.

## Make a module-aware change

Goal: add or modify functionality without assuming a module exists.

- Check `config/modules.ts` first.
- If the module is enabled, edit the app-owned route or API surface before considering package forks.
- If the module is not enabled, do not create links or routes that assume it exists.
