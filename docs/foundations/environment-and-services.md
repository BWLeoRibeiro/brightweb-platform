# Environment and Services

This page explains the generated environment keys, config ownership, and service expectations for the public BrightWeb scaffold. Use it after installation when you need to review the generated platform config and fill in `.env.local`.

The current public scaffold only generates `.env.local` for the `platform` template. The `site` template does not require environment keys to render its starter page.

## Exact `.env.local` flow

1. Scaffold a `platform` app with `create-bw-app`.
2. Open the generated `config/brand.ts` and `config/modules.ts` files in the new project root.
3. Confirm the generated starter identity and enabled modules match the app you want to validate.
4. Open the generated `.env.local` file in the project root.
5. Replace placeholder service values with the real values for your own environment.

> Brand defaults and module selection are starter config, not environment state. Keep them in `config/brand.ts` and `config/modules.ts`.
>
> The generated `.env.local` already includes blank placeholders for every current platform key. For admin-enabled apps, that includes the full app-owned Resend set, so the first-run task is to fill values, not invent env names.

## Reminder: match the app URL to the environment

- `NEXT_PUBLIC_APP_URL` must always point to the exact public URL of the environment that is currently running the app.
- In local development, set it in `.env.local` to your local URL, for example `http://localhost:3000`.
- In a shared dev or staging deployment, set the dev/staging domain in that environment's deployment env vars.
- In production, set the final production domain in the production env vars.
- Do not reuse the local URL in dev/staging/prod, and do not point dev/staging to the production domain. Auth callbacks and reset-password links are built from this value.

## Service keys generated for platform apps

| Key | Scope | Required for | Purpose | Where the real value comes from |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | public | `core-auth` | Canonical base URL used by auth callbacks and platform links. | The public URL for the current environment: local URL in `.env.local`, dev/staging domain in dev env vars, and the final domain in production env vars. |
| `NEXT_PUBLIC_SUPABASE_URL` | public | `crm`, `projects`, `admin` | Supabase project URL used by client-side and server-side API access. | The target Supabase project settings. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | public | `crm`, `projects`, `admin` | Browser-safe Supabase key for auth and RPC access. | The target Supabase project settings. |
| `SUPABASE_SECRET_DEFAULT_KEY` | server | `crm`, `projects`, `admin` | Privileged server key for admin, CRM, and projects actions. | The target Supabase project settings. |
| `RESEND_API_KEY` | server | `admin` | API key used by app-owned email transport calls. | Your Resend account. |
| `RESEND_FROM_TRANSACTIONAL` | server | `admin` | Sender identity for app-owned transactional flows. | A verified sender/domain in Resend. |
| `RESEND_FROM_MARKETING` | server | `admin` | Sender identity for app-owned marketing flows. | A verified sender/domain in Resend. |
| `CONTACT_TO_EMAIL` | server | `admin` | Destination inbox for app-owned contact notifications. | Inbox address owned by the client. |
| `RESEND_WEBHOOK_SECRET` | server | `admin` | Secret used to verify inbound Resend webhook signatures. | The webhook secret configured in Resend. |
| `MARKETING_WORKER_SECRET` | server | `admin` | Shared secret for internal marketing worker endpoints. | A project-owned random secret. |
| `MARKETING_TEST_EMAIL` | server | `admin` | Recipient for admin marketing test sends. | A test mailbox controlled by the project team. |

## Current marketing data boundary

- The current platform starter uses Resend as an email delivery transport, not as the source of truth for marketing audience state.
- The generated env contract does not include topic-ID variables, and the current starter does not create or manage ESP topic resources.
- Operational contact data lives in Supabase CRM tables such as `crm_contacts` and `organization_invitations`.
- Global user preference state lives in Supabase core tables such as `user_preferences` and `user_notification_state`.
- If a project later syncs app-owned subscription state to an ESP such as Resend, that mapping is app-specific and not part of the current BrightWeb scaffold contract.

## Auth email delivery vs app-owned email delivery

- Auth email flows (`signUp`, resend confirmation, reset password) are Supabase-owned and use `supabase.auth.*`.
- Auth provider and SMTP behavior are configured in Supabase Auth settings, not in the app transport layer.
- App-owned transactional, contact, invite, and marketing flows should call Resend via `@brightweblabs/infra/server`.

## Generated platform config files

### `config/brand.ts`

- Holds company name, product name, slug, tagline, contact email, support email, and primary brand color.
- Generated from the scaffold slug plus BrightWeb starter defaults.
- Edit this file when the starter identity should change.

### `config/modules.ts`

- Holds module metadata plus the enabled state for CRM, Projects, and Admin.
- Generated from the module choices you made during scaffold time.
- Edit this file when you want the starter routes and shell wiring to reflect a different module set.

## What each template expects

### Site

- No generated `.env.local`
- No required external services for the starter page
- First customization usually happens in `config/site.ts`, `app/page.tsx`, and `app/globals.css`

### Platform

- Generated `.env.local`
- Supabase and Resend are the main external services the starter expects
- Admin-enabled apps include blank placeholders for the full app-owned Resend/admin key set in `.env.local`
- Optional module routes need the matching database schema and access model in the target client database
- Starter identity and module selection live in `config/brand.ts` and `config/modules.ts`

## Validate after editing `.env.local`

For platform apps:

1. Run the app locally.
2. Open `/`.
3. Open `/bootstrap`.
4. Confirm the starter reports the expected readiness state.
5. Open the generated playground routes and confirm they either connect successfully or show the exact missing configuration you still need to fill in.

For the route-by-route checks, use [Validate Your Starter](./validate-your-starter.md).

## Related docs

- [Prerequisites](./prerequisites.md)
- [Installation](./installation.md)
- [Validate Your Starter](./validate-your-starter.md)
- [Project Structure](./project-structure.md)
