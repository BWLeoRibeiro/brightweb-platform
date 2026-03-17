# Agent Guide

This file is the local routing guide for AI agents working inside a generated BrightWeb site app.

It is intentionally app-scoped. It explains the generated project you are in, not the maintainer-only BrightWeb monorepo internals.

## Project shape

This app is a normal Next.js App Router project with a local UI layer and light configuration.

- `app/`: route tree, layouts, and the starter landing page.
- `components/ui/`: local UI primitives used by the starter surface.
- `config/site.ts`: generated site identity, description, and CTA defaults.
- `lib/`: helper utilities such as class merging.

## Fast routing map

- `docs/ai/app-context.json`: machine-readable summary of this app's template, starter routes, and first-read files.
- `docs/ai/examples.md`: common setup and customization workflows.
- `README.md`: first-run setup steps.
- `config/site.ts`: site name, description, eyebrow, and starter CTA links.
- `app/page.tsx`: starter composition for the home page.
- `app/globals.css`: theme tokens, layout defaults, and base typography.
- `components/ui/*`: local component primitives used by the starter.

## Editing strategy

- Change `config/site.ts` first when the task is mostly copy or link updates.
- Change `app/page.tsx` first when the task is about page structure or section flow.
- Change `app/globals.css` and `components/ui/*` when the task affects the visual system.
- Keep changes local to this app unless the task explicitly requires a shared BrightWeb package.

## Validation checklist

1. Run the app locally.
2. Validate `/` on desktop and mobile sizes.
3. If you changed the visual system, check both `app/globals.css` and the affected `components/ui/*` files.
