# Installation

`create-bw-app` is the BrightWeb scaffold for starting either a platform app or a standalone site.

Use the public CLI when you want a new project quickly without manual starter wiring.

Both templates generate normal Next.js App Router projects. After scaffolding, you work in the generated app like any
other Next.js project, including the usual `app/` route and page structure.

## Quick start

Start the interactive scaffold:

```bash
pnpm dlx create-bw-app
```

Common variants:

- Show all options: `pnpm dlx create-bw-app --help`
- Start from the site template directly: `pnpm dlx create-bw-app --template site`
- Preconfigure a platform app and skip install: `pnpm dlx create-bw-app --name client-portal --modules crm,projects --no-install`
- Use npm instead of pnpm: `npm create bw-app@latest -- --template site`

## Choose the right template

- **Platform app**: authenticated BrightWeb app shell with optional shared business modules such as CRM and Projects.
- **Site app**: lighter standalone Next.js site starter without the full BrightWeb platform runtime.

If you are unsure, start with `platform` only when you need shared platform auth, shell, or module-backed product work. Otherwise choose `site`.

## Typical flow

1. From the parent directory where you want the new app to live, run `pnpm dlx create-bw-app` and choose the template.
2. If creating a platform app, choose optional modules based on the product scope.
3. Change into the generated app directory and install dependencies if you skipped install during scaffolding.
4. Review `.env.example`, copy it to `.env.local`, and fill in real credentials.
5. Run the app from the generated project with `pnpm dev`.

## Related

- [Project Structure](./project-structure.md)
- [Platform Base](../modules/platform-base.md)
- [Modules](../modules/README.md)
- [Examples and Recipes](../recipes/README.md)
