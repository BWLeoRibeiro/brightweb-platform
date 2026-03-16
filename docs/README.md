# BrightWeb Stack Docs

BrightWeb Stack is the shared foundation for building authenticated platform apps and standalone sites with a common scaffold, shared packages, and durable module boundaries. The public docs are optimized for external users starting from `create-bw-app`.

The markdown in this folder is the source of truth for both the repository docs and the `apps/dev-docs` site.

## Public docs sections

- [Getting Started](./foundations/README.md): the external-first onboarding path from prerequisites through starter validation
- [Modules](./modules/README.md): what the platform base includes and how CRM and Projects extend that baseline
- [Recipes](./recipes/README.md): practical how-to pages for first-run customization, module expansion, and retiring starter surfaces

## How to read the docs

If you are new to the stack, start in this order:

1. [Prerequisites](./foundations/prerequisites.md)
2. [Installation](./foundations/installation.md)
3. [Environment and Services](./foundations/environment-and-services.md)
4. [Project Structure](./foundations/project-structure.md)
5. [Validate Your Starter](./foundations/validate-your-starter.md)
6. [Modules](./modules/README.md)
7. [Recipes](./recipes/README.md)

Maintainer-only notes, architecture decisions, and operational runbooks live in the repo under `docs/internal/`. They are intentionally excluded from the public docs app navigation.

## Assumed background

The public docs assume working familiarity with:

- HTML
- CSS
- JavaScript or TypeScript
- React
- Next.js

If you are working with module-backed platform apps, basic Supabase familiarity is also useful.
