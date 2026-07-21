# Agent Guide

This generated site contains settings, theme files, root layout wiring, and docs only. It has no default feature surface.

- `config/site.ts`: site identity settings.
- `app/globals.css`: site theme tokens and global styling.
- `app/layout.tsx`: root document wiring.
- `docs/ai/app-context.json`: machine-readable ownership summary.

Create UI in a reusable package and add only a direct package re-export under `app/`.
