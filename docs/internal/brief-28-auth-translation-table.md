# Brief 28 — auth translation table and design notes

## Literal ports

The source repository is read-only. Line ranges below refer to the MQ source at the time of the port.

| MQ source | MQ lines | BrightWeb package target |
| --- | ---: | --- |
| `app/(auth)/login/page.tsx` | 1–545 | `packages/core-auth/src/ui/login-page.tsx`; shared frame primitives in `auth-layout.tsx` |
| `app/(auth)/forgot-password/page.tsx` | 1–251 | `packages/core-auth/src/ui/forgot-password-page.tsx` |
| `app/(auth)/reset-password/page.tsx` | 1–333 | `packages/core-auth/src/ui/reset-password-page.tsx` |
| `app/(auth)/invite/[invitationId]/page.tsx` | 1–35 | `packages/core-auth/src/ui/invite-page.tsx` |
| `app/(auth)/invite/[invitationId]/invite-page-client.tsx` | 1–375 | `packages/core-auth/src/ui/invite-page.tsx` (`kind="organization"`) |
| `app/(auth)/admin-invite/[invitationId]/page.tsx` | 1–37 | `packages/core-auth/src/ui/invite-page.tsx` |
| `app/(auth)/admin-invite/[invitationId]/admin-invite-page-client.tsx` | 1–372 | `packages/core-auth/src/ui/invite-page.tsx` (`kind="admin"`) |
| `app/(auth)/auth/confirmed/page.tsx` | 1–68 | `packages/core-auth/src/ui/confirmed-page.tsx` |
| `app/(auth)/auth/callback/route.ts` | 1–127 | `packages/core-auth/src/routes.ts` (`handleAuthCallbackRequest`) |
| `app/auth/cleanup/route.ts` | 1–21 | `packages/core-auth/src/routes.ts` (`handleAuthCleanupRequest`) |

MQ's auth-specific `.auth-experience`, `.auth-vessel`, typography, eyebrow, notice, and form-side rules were swept from `app/globals.css` lines 808–900, 1207–1217, and 1335–1467. Their package equivalents are in `packages/core-auth/tokens.css`. Application routes contain only package composition and injected configuration.

All user-facing copy is read from `defaultAuthUiDictionary`. UI modules do not import Supabase. The default adapter in `ui/client.ts` is the only browser integration point and delegates client construction to `@brightweblabs/infra/client`.

## Redesigned auth layout

The default treatment is a centered brand logo, one portal-language surface card, and a muted company/help footer over `--page-background`. The optional split treatment moves brand copy to a responsive left panel and leaves the routed form on the right. `/login?variant=split` is the comparison route.

## Redesigned post-login

`post-login-page.tsx` retains the MQ internal-path allow list, auth-route rejection, role gates, invitation acceptance, and role fallback. Presentation is a full-page brand transition with a spinner. The skeleton line appears only after 400 ms and uses the auth skeleton tokens.

## New token inventory

Defaults live in `@brightweblabs/core-auth/tokens.css` at the auth experience layer. MQ overrides live in `@brightweblabs/theme/themes/mq`.

| Token | Layer | Neutral default | MQ override |
| --- | --- | --- | --- |
| `--auth-wash` | L3 auth | low-opacity `--brand-accent` radial wash | stronger MQ accent wash |
| `--auth-card-surface` | L3 auth | mixed semantic `--card` | MQ semantic card mix |
| `--auth-card-border` | L3 auth | `--border-hairline-soft` | MQ accent/border mix |
| `--auth-card-shadow` | L3 auth | `--brand-shadow-soft` | MQ brand shadow |
| `--auth-card-radius` | L3 auth | `--radius-panel` | MQ panel radius |
| `--auth-panel-surface` | L3 auth | `--brand-surface-dark` | `--brand-panel-surface` |
| `--auth-panel-foreground` | L3 auth | `--foreground-inverse` | `--brand-panel-foreground` |
| `--auth-panel-muted` | L3 auth | `--foreground-inverse-muted` | `--brand-panel-muted` |
| `--auth-panel-border` | L3 auth | accent mix | `--brand-panel-border` |
| `--auth-success-surface` | L3 auth | `--surface-status-success` | MQ semantic success surface |
| `--auth-success-border` | L3 auth | semantic success mix | MQ semantic success mix |
| `--auth-success-foreground` | L3 auth | `--semantic-success-strong` | MQ semantic success strong |
| `--auth-error-surface` | L3 auth | `--surface-danger-subtle` | MQ semantic danger surface |
| `--auth-error-border` | L3 auth | destructive mix | MQ destructive mix |
| `--auth-error-foreground` | L3 auth | `--destructive` | MQ destructive |
| `--auth-skeleton-surface` | L3 auth | `--elevate-2` | MQ elevation token |
| `--auth-skeleton-highlight` | L3 auth | semantic card mix | MQ semantic card mix |

## Proof commands

```sh
rg -n "from [\"']@supabase|from [\"']@brightweblabs/infra" packages/core-auth/src/ui --glob '*.tsx'
rg -n "#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\(" packages/core-auth/src/ui packages/core-auth/tokens.css
rg -n '"[A-Za-z][A-Za-z ]{3,}"' packages/core-auth/src/ui/dictionary.ts
```

The first command must return no direct Supabase/infra imports from UI components. Raw color recipes are absent from component source; CSS recipes are expressed through semantic tokens and `color-mix`.
