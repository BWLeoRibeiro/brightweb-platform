# Marketing Module

The Marketing module provides consent-first email campaigns, audience segments, automation workflows, delivery processing, unsubscribe handling, and analytics. It depends on Core, Admin, Organizations, and CRM because campaigns target CRM contacts under the platform's staff access model.

> Selecting Marketing auto-includes its required modules and mounts the complete `/marketing` workspace plus the package-backed API route family.

Use [Base Contract](./base-contract.md) for support tiers, [base-contract.json](./base-contract.json) for the canonical symbol inventory, and [Marketing Delivery & Scheduler](./marketing-delivery.md) for production delivery operations.

## What schema it installs

The module owns:

- consent topics, contact subscriptions, contact settings, unsubscribe tokens, and suppressions;
- campaigns, campaign recipients, message events, segments, and contact tags;
- workflows, ordered workflow nodes, workflow runs, and workflow step runs;
- worker cursors plus database functions for topic ordering, workflow claiming, webhook processing, and update timestamps.

Follow-up migrations add delivery-engine safety, transactional Resend webhook processing, topic ordering, collection indexes, and lifecycle-safe deletion behavior.

Marketing tables are service-role-only. The package's page and request handlers authenticate the user as `staff` or `admin` before switching to the service client for protected marketing reads and writes.

## What the package provides

| Concern | Current behavior |
| --- | --- |
| Consent | Topic CRUD and ordering, per-contact subscription state, unsubscribe tokens, suppression, and emailable checks. |
| Campaigns | Paginated search, create/update/delete, recipient expansion, scheduling, immediate sending, cancellation, retry, test sends, and recipient removal. |
| Segments | Paginated search, CRUD, rule previews, and contact resolution. |
| Workflows | Paginated search, CRUD, activation/pause, ordered nodes, run inspection, trigger enqueueing, activity scanning, and due-run processing. |
| Analytics | Overview, campaign, and segment metrics derived from recipients and message events. |
| Delivery | Injectable email sender, bounded worker, signed Resend webhook processing, retry scheduling, and one-click unsubscribe headers. |
| UI | A complete package-owned workspace for campaigns, topics, segments, workflows, and lazy analytics. |

## Scaffolded routes and configuration

The generated `/marketing` page directly re-exports `MarketingPage`. The generated `/api/marketing` route family mounts package-backed handlers for:

- campaigns, recipients, send, schedule, cancel, retry, and test delivery;
- topics and topic ordering;
- segments and previews;
- workflows, nodes, activation, pause, and runs;
- overview, campaign, and segment analytics;
- the internal worker, Resend webhook, and public unsubscribe endpoint.

The generated `_handlers.ts` file is the app-owned composition boundary. It injects the Resend or no-op sender, worker secret, webhook secret, and public application URL into `createMarketingCampaignHandlers()`.

Production delivery configuration:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `MARKETING_WORKER_SECRET`
- `MARKETING_FROM_EMAIL`
- `MARKETING_FROM_NAME`
- `PUBLIC_APP_URL` or `NEXT_PUBLIC_APP_URL`

When the Resend key or sender address is absent, the generated composition uses `createNoopEmailSender()`. This keeps local UI work available but does not deliver campaign email.

## Supported package entrypoints

### Stable domain and delivery helpers

- `@brightweblabs/module-marketing/server`: consent topics, subscriptions, suppressions, unsubscribe resolution, and `createMarketingServiceClient()`
- `@brightweblabs/module-marketing/campaigns`: campaign lifecycle, recipients, scheduling, sending, retry, and test delivery
- `@brightweblabs/module-marketing/segments`: segment lifecycle, contact resolution, and previews
- `@brightweblabs/module-marketing`: workflow lifecycle and processing, analytics helpers, webhook processing, and handler composition
- `@brightweblabs/module-marketing/worker`: `runMarketingWorker()`
- `@brightweblabs/module-marketing/email`: `createResendEmailSender()` and `createNoopEmailSender()`
- `@brightweblabs/module-marketing/registration`: `marketingModuleRegistration`

### Starter UI

- `@brightweblabs/module-marketing`: `MarketingPage`
- `@brightweblabs/module-marketing/ui`: `MarketingClient`, `MarketingUiProvider`, `createMarketingUiClient()`, `MarketingToolbarControls`, `TopicWorkspace`, and `WorkflowWorkspace`

The UI entrypoints are supported fast-start surfaces. Apps that need a substantially different product experience should build on the stable domain helpers and injectable `MarketingUiClient` rather than copying package internals.

## Mount the package workspace

```tsx
export { MarketingPage as default } from "@brightweblabs/module-marketing";
```

`MarketingPage` enforces `staff` or `admin` access, requires a configured Supabase service-role client, loads the first campaign, topic, segment, workflow, and analytics slices, and then renders the client workspace.

For a custom surface, inject the HTTP client:

```tsx
import {
  MarketingClient,
  MarketingUiProvider,
  createMarketingUiClient,
} from "@brightweblabs/module-marketing/ui";

const client = createMarketingUiClient("/api/marketing");

<MarketingUiProvider client={client}>
  <MarketingClient
    initialCampaigns={campaigns}
    initialTopics={topics}
    initialSegments={segments}
    initialWorkflows={workflows}
    initialOverview={overview}
    initialCampaignAnalytics={{}}
  />
</MarketingUiProvider>;
```

## Compose production handlers

```ts
import {
  createMarketingCampaignHandlers,
  createResendEmailSender,
} from "@brightweblabs/module-marketing";

const handlers = createMarketingCampaignHandlers({
  sender: createResendEmailSender({
    apiKey: process.env.RESEND_API_KEY!,
    defaultFromEmail: process.env.MARKETING_FROM_EMAIL!,
    defaultFromName: process.env.MARKETING_FROM_NAME ?? "BrightWeb",
  }),
  workerSecret: process.env.MARKETING_WORKER_SECRET!,
  webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
  publicAppUrl: process.env.PUBLIC_APP_URL,
});
```

Keep provider secrets in this server-only app composition. Do not pass them to `MarketingClient` or another browser component.

## Delivery invariants

- Recipient expansion applies topic consent and suppression before queueing.
- Worker claims are bounded and safe under concurrent invocations.
- Delivery failures use capped retry scheduling; manual retry is available for failed recipients.
- Resend webhook signatures are verified before a single transactional database function records events and applies hard-event suppression.
- Every delivered campaign message includes one-click unsubscribe headers when the public URL and contact token are available.
- Campaign, segment, workflow, topic, recipient, and related deletion paths enforce their lifecycle constraints rather than relying on UI confirmation alone.

See [Marketing Delivery & Scheduler](./marketing-delivery.md) for worker scheduling, webhook setup, and operational verification.

## Implementation references

- `packages/module-marketing/src`
- `packages/module-marketing/brightweb.module.json`
- `packages/create-bw-app/template/modules/marketing`
- `packages/create-bw-app/template/supabase/modules/marketing/migrations`
