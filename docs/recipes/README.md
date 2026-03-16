# Examples and Recipes

This section stays intentionally practical. Each page documents a real public workflow that exists today, including the parts that are still manual.

## What these pages are for

- starting from the public scaffold and validating the starter routes
- customizing the generated platform or site starter without guessing where the key files live
- documenting the manual workflows that still exist after generation

## Recipes in this section

- [Platform First Run](./platform-first-run.md): scaffold a platform app, configure its environment, and verify the generated routes.
- [Site First Customization](./site-first-customization.md): scaffold the site starter and make the first round of copy, CTA, and visual changes.
- [Add Modules After Scaffold](./add-modules-after-scaffold.md): follow the current manual path for adding a module to an existing platform app.
- [Replace Starter Surfaces](./replace-starter-surfaces.md): move from starter pages and starter helpers to app-owned product routes.

## How to use these recipes

- Start in [Getting Started](../foundations/README.md) if you have not scaffolded the app yet.
- Use recipe pages when you already have a generated project and need task-level guidance.
- Expect manual steps where BrightWeb does not yet expose a one-command workflow.

## Related docs

- [Getting Started](../foundations/README.md)
- [Installation](../foundations/installation.md)
- [Validate Your Starter](../foundations/validate-your-starter.md)
- [Modules](../modules/README.md)

## Implementation references

- `packages/create-bw-app/src/generator.mjs`
- `packages/create-bw-app/template/base`
- `packages/create-bw-app/template/modules`
