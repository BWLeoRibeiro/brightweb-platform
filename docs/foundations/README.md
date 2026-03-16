# Getting Started

This section is the public onboarding path for `create-bw-app`.

Start here when you need to choose the right template, understand the generated file structure, or translate BrightWeb terms into normal Next.js project shape.

## Recommended read path

1. [Installation](./installation.md) for the scaffold workflow and common CLI variants.
2. [Project Structure](./project-structure.md) for the generated files, folders, and starter routes.
3. [Platform Base](../modules/platform-base.md) when you are building a `platform` app and need to understand the default runtime and database baseline.

## Platform app vs standalone site

BrightWeb Stack scaffolds two different application shapes:

- `platform`: authenticated BrightWeb app shell with shared runtime wiring and optional business modules
- `site`: standalone Next.js App Router site starter with a local UI layer

Do not assume the `site` template includes platform auth, shared shell behavior, or module-backed product wiring. That distinction drives which parts of the rest of the docs apply to your project.

## Pages in this section

- [Installation](./installation.md)
- [Template Selection Redirect](./create-an-app-templates.md)
- [Project Structure](./project-structure.md)
