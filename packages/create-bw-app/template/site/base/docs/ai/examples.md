# Agent Examples

Use these workflows after reading `AGENTS.md`, `docs/ai/README.md`, and `docs/ai/app-context.json`.

## First local setup

Goal: get the generated site starter running and ready for edits.

- Run the local dev server for this app or workspace.
- Open `/` and confirm the starter renders correctly.
- Review `config/site.ts`, `app/page.tsx`, and `app/globals.css` before making large changes.

## Change site identity

Goal: update the starter name, description, and CTA links.

- Edit `config/site.ts`.
- Validate `/` after the change.
- If copy still exists outside the config file, update `app/page.tsx`.

## Restyle the starter

Goal: change the visual language without rewriting everything at once.

- Start in `app/globals.css` for colors, spacing, and typography direction.
- Update `components/ui/*` if shared primitives need to change.
- Validate `/` on both desktop and mobile sizes.

## Replace the starter sections

Goal: turn the scaffold into a real site.

- Edit `app/page.tsx` section by section.
- Keep shared button, badge, and card behavior in `components/ui/*`.
- Remove starter content only after the replacement section is in place.
