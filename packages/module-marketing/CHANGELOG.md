# @brightweblabs/module-marketing

## 0.2.6

### Patch Changes

- Updated dependencies [e02eaad]
  - @brightweblabs/core-auth@0.7.1
  - @brightweblabs/app-shell@0.7.1

## 0.2.5

### Patch Changes

- 29774b0: Read marketing data with the service role instead of the caller's session.

  `MarketingPage` gated on `requireServerPageRoleAccess(["staff", "admin"])` and
  then reused that request-scoped client for every read. All marketing tables are
  service-role-only — RLS grants no policy to `authenticated` — so:

  - campaigns, topics, workflows and analytics silently returned **empty**, and
  - `marketing_segments`, which additionally revokes the table grant from
    `authenticated`, threw `permission denied for table marketing_segments`.

  The page therefore returned a 500, and would have rendered blank even if
  segments had not been revoked. Found on a live deployment, where `/marketing`
  failed with that digest while every other surface worked.

  The role gate still runs against the caller's session; only the data reads use
  `createServiceRoleClient()`. Apps without `SUPABASE_SECRET_DEFAULT_KEY` now get
  an explicit error naming the missing variable rather than an empty page.

- Updated dependencies [44a415e]
  - @brightweblabs/app-shell@0.7.0

## 0.2.4

### Patch Changes

- Updated dependencies [10ae6b6]
  - @brightweblabs/infra@0.4.0
  - @brightweblabs/core-auth@0.7.0
  - @brightweblabs/ui@1.1.1
  - @brightweblabs/app-shell@0.6.2

## 0.2.3

### Patch Changes

- Updated dependencies [032215e]
  - @brightweblabs/core-auth@0.6.1

## 0.2.2

### Patch Changes

- Updated dependencies [41fa7ee]
  - @brightweblabs/core-auth@0.6.0

## 0.2.1

### Patch Changes

- 89b5a6e: Style the marketing workspaces and align the UI client, HTTP handlers, and localized interface contract.
- b9575c3: Fix campaign and workflow consent enforcement, delivery recovery, activity triggers, and the CRM event manifest declaration.
- Updated dependencies [ba77169]
- Updated dependencies [7eafa76]
  - @brightweblabs/app-shell@0.6.1
  - @brightweblabs/core-auth@0.5.1
  - @brightweblabs/infra@0.3.3

## 0.2.0

### Minor Changes

- a4e9cf7: Add consent-aware marketing workflow automation, activity triggers, worker processing, and staff REST endpoints.
- 43acafa: Add the consent-aware campaign sending backbone, including campaign persistence,
  recipient expansion, an injectable email worker, Resend delivery, verified
  webhooks, and staff-gated API handlers.
- 401b93e: Introduce the consent-first Marketing module with topic subscriptions, stable unsubscribe tokens, suppression checks, and public token-gated unsubscribe handlers.
- dbc9a46: Add saved marketing audience segments, staff APIs, live previews, and consent-safe campaign targeting.
- 794b281: Add the staff-facing Marketing campaign workspace UI: an injectable UI client,
  pt-PT dictionary, the campaign list and editor (topic picker, body with a
  personalization token picker, and send/schedule/cancel/retry/test controls with
  a recipient-status panel), a topics endpoint, and shell nav registration.
- 6e2948c: Add the staff-facing workflow workspace with trigger configuration, a linear ordered step editor, activation controls, and recent run visibility.
- cce8a81: Add staff-only marketing analytics with unique-recipient engagement rates and campaign queue breakdowns.

### Patch Changes

- Updated dependencies [22e50aa]
- Updated dependencies [41714ca]
  - @brightweblabs/core-auth@0.5.0
