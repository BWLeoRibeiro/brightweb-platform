# Prerequisites

Use this page before running `create-bw-app`. It covers the supported local setup, how to choose between the two public templates, and which external services the starter expects.

## Local toolchain

The public scaffold package currently declares `node >=20`.

For the public path, plan on having:

- Node.js 20 or newer
- a package manager for the generated app; the public examples use `pnpm` or `npm`
- a terminal where you can run the scaffold and the generated Next.js scripts
- Git if you want to commit the generated project immediately

BrightWeb does not require a private workspace checkout for the public scaffold flow. The external-first path starts from `pnpm dlx create-bw-app` or `npm create bw-app@latest`.

## Choose the right template

| Template | Choose it when | What you get on day 1 | Services required to fully validate the starter |
| --- | --- | --- | --- |
| `platform` | You need shared auth, app-shell wiring, and optional BrightWeb business modules such as CRM or Projects. | A thin authenticated shell with settings, `.env.local`, migrations, and direct CRM/Admin package mounts when selected. | Supabase and Resend. Optional modules also need the matching database schema available in the target client database. |
| `site` | You need a standalone marketing or editorial site without the heavier platform runtime. | A thin Next.js App Router shell with `config/site.ts`, theme tokens, and no default feature page. | None for the shell itself. |

## Service expectations by template

### Site

- The site shell builds without a generated `.env.local`.
- Identity and theme settings live in `config/site.ts` and `app/globals.css`; page UI belongs in a package.
- Add third-party services only when your own site requirements need them.

### Platform

- The platform starter writes `.env.local` for service values and generated config files for starter brand and module state.
- The scaffold can build before every service value is filled in, but package-mounted runtime routes require their real auth and service configuration.
- Auth and module playground routes become genuinely useful only after the external services and database schema are configured.

## Module selection expectations

- `crm`, `projects`, and `admin` control package wiring, generated runtime config, and available package mounts.
- The platform database baseline always includes `Core + Admin`. Selecting `admin` controls whether the Admin package mount and wiring are scaffolded.
- Projects build on the Core + Admin + Organizations database baseline without requiring CRM.

## Recommended first path

1. Choose `site` if you want the fastest path to a public-facing Next.js starter without platform auth or module-backed workflows.
2. Choose `platform` if you need the BrightWeb shell, auth layer, or module-backed product work.
3. Read [Installation](./installation.md) next, then move to [Environment and Services](./environment-and-services.md) if you picked `platform`.

## Related docs

- [Installation](./installation.md)
- [Environment and Services](./environment-and-services.md)
- [Project Structure](./project-structure.md)
- [Validate Your Starter](./validate-your-starter.md)
