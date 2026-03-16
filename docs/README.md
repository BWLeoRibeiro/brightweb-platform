# BrightWeb Platform Docs

This `docs/` folder is the single source of truth for BrightWeb documentation.

- Humans should be able to read it directly in the repo.
- The `dev-docs` app renders the same files online.
- Agents should read and update docs here, not in `apps/dev-docs/app/docs`.

## Fast map

- Start at [Foundations](./foundations/README.md)
- Then read [Modules](./modules/README.md)
- Then use [Architecture reference](./architecture/README.md) and [Operations reference](./operations/README.md) as needed
- Treat this file as the docs index for both humans and agents

## Sections

- [Foundations](./foundations/README.md)
- [Modules](./modules/README.md)
- [Architecture reference](./architecture/README.md)
- [Operations reference](./operations/README.md)
- [Recipes](./recipes/README.md)

## Recommended read order

1. [Foundations](./foundations/README.md)
2. [Modules](./modules/README.md)
3. [Architecture reference](./architecture/README.md)
4. [Operations reference](./operations/README.md)
5. [Recipes](./recipes/README.md)

## How this repo should use docs

1. Put durable product, architecture, and operations knowledge in `docs/`.
2. Keep app-only documentation logic out of `apps/dev-docs` when possible.
3. Treat the docs app as a presentation layer over this folder, not a separate content system.
