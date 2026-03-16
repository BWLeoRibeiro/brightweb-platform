# BrightWeb Stack Docs

BrightWeb Stack is the shared foundation for building authenticated platform apps and standalone sites with a common scaffold, shared packages, and durable module boundaries.

The markdown in this folder is the source of truth for both the repository docs and the `apps/dev-docs` site.

## Public docs sections

- [Getting Started](./foundations/README.md): how to install the scaffold, choose between `platform` and `site`, and read the generated project structure
- [Modules](./modules/README.md): what the platform base includes and how CRM and Projects extend that baseline
- [Recipes](./recipes/README.md): practical workflows for common BrightWeb tasks that still require manual follow-up

## How to read the docs

If you are new to the stack, start in this order:

1. [Getting Started](./foundations/README.md)
2. [Modules](./modules/README.md)
3. [Recipes](./recipes/README.md)

Maintainer-only notes, architecture decisions, and operational runbooks live in the repo under `docs/internal/`. They are intentionally excluded from the public docs app navigation.

## Assumed background

The public docs assume working familiarity with:

- HTML
- CSS
- JavaScript or TypeScript
- React
- Next.js

If you are working with module-backed platform apps, basic Supabase familiarity is also useful.
