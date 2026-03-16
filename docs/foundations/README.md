# Getting Started

This section is the external-first onboarding path for `create-bw-app`. Use it to get from local prerequisites to a validated starter before you start replacing the generated surfaces with app-owned product work.

Start here when you need to choose the right template, understand the generated file structure, configure the starter environment, and verify that the generated routes behave the way the scaffold promises.

## Recommended read path

1. [Prerequisites](./prerequisites.md) for supported local setup and template choice.
2. [Installation](./installation.md) for the scaffold workflow and common CLI variants.
3. [Environment and Services](./environment-and-services.md) for `.env.local`, service ownership, and platform config ownership.
4. [Project Structure](./project-structure.md) for the generated files, folders, and starter routes.
5. [Validate Your Starter](./validate-your-starter.md) for the first-run route checks.

## Platform app vs standalone site

BrightWeb Stack scaffolds two different application shapes:

- `platform`: authenticated BrightWeb app shell with shared runtime wiring and optional business modules
- `site`: standalone Next.js App Router site starter with a local UI layer

Do not assume the `site` template includes platform auth, shared shell behavior, or module-backed product wiring. That distinction drives which parts of the rest of the docs apply to your project.

## Pages in this section

- [Prerequisites](./prerequisites.md)
- [Installation](./installation.md)
- [Environment and Services](./environment-and-services.md)
- [Project Structure](./project-structure.md)
- [Validate Your Starter](./validate-your-starter.md)
