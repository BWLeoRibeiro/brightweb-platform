---
"create-bw-app": minor
---

Move shell brand marks into `config/brand.ts` so rebranding survives updates.

The logo paths, home href and aria-label were generated into `config/shell.ts`,
which `create-bw-app update` regenerates — so any app that swapped in client
artwork had it reverted to the scaffold defaults on the next update. They now
live in `config/brand.ts` as `starterShellBrand`, which is written once at
scaffold time and never regenerated, and `shell.ts` just references it.

This is the same class of problem as `additionalShellModules`: a file the CLI
owns was the only place to put app-owned values.

The Ferramentas section's `collapsedHref` now also prefers the first
app-owned nav entry before falling back to the first module route, so an app
with its own tools surface gets a sensible collapsed target.
