# BrightWeb Platform Remediation Audit

Date: 2026-07-29
Branch: `feat/review-fixes`
Baseline: `4a43d1c1409cbcff65763785e6de1e87296e77d3`

## Verdict

**READY FOR REVIEW; EXTERNAL STAGING EVIDENCE STILL REQUIRED BEFORE PRODUCTION RELEASE.**

The platform-owned defects found by the gap audit are fixed and covered by local, generated-runtime, browser, and packed-release checks. No production deployment or external service mutation was performed.

## Closed findings

| Finding | Closure evidence |
|---|---|
| Theme providers and storage keys diverged | UI owns one system-aware controller; app-shell re-exports it; stored light/dark/system and storage-blocked bootstrap are tested. |
| Fresh browsers were forced light | Preview and generated platform layouts default to `system`; browser checks resolved fresh dark, stored light, and stored system correctly. |
| Auth card forced nested dark mode | Forced `dark` class removed. |
| Auth geometry depended on host utilities | Package CSS owns 36px mobile and 40px desktop padding; scaffold also scans core-auth source. |
| Auth accessibility gaps | Skip link, Portuguese document language, logical h1/h2 DOM order, stable input names, autofill attributes, contrast-safe support copy, and responsive invite name fields added. |
| Clean pnpm 11 install failed on Sharp | Standalone pnpm scaffolds explicitly allow the reviewed Sharp install script. |
| Candidate packages were not tested as published artifacts | CI now versions, packs, publishes to an isolated Verdaccio registry, generates an all-module consumer, installs with pnpm 11, typechecks, and builds it. The npm execution cache is isolated per run. |
| Existing apps could not converge on keepalive route | Keepalive is part of the managed starter inventory and the preview mount; updater restoration is tested. |
| Generated runtime omitted Admin, Marketing, and mutations | Stateful smoke now covers unauthenticated redirects, authenticated SSR, Admin reads and reversible role mutation, Marketing CRUD, and keepalive authorization. |
| Marketing silently truncated or amplified large audiences | Subscription/contact/suppression reads are paginated or chunked, writes are chunked, delivery updates are concurrency-bounded, and 1,205-recipient deterministic tests cover completeness and suppression. |

## Verification

- `pnpm test`: 330/330 passed.
- `pnpm lint`: passed.
- `pnpm build`: passed.
- `pnpm lint:docs` and `pnpm build:docs`: passed.
- `pnpm release:check`: passed.
- Base contract: 187 entries passed.
- Compatibility set: 11 package versions and 10 app defaults passed.
- Module manifests: 5 passed.
- Generated template checks: all platform/site variants typechecked.
- Generated runtime smoke: 48 assertions passed.
- Packed candidate: `create-bw-app@0.20.0` installed and built from an isolated registry with pnpm 11.
- Production dependency audit: no known high-severity vulnerabilities.
- Browser: system/light/dark bootstrap, desktop/mobile auth padding and overflow, document language, heading order, input semantics, skip-link DOM order, and media-aware theme-color tags inspected.

## External evidence still open

These are environment/control-plane validations rather than remaining platform source defects:

1. Authenticated Admin and Marketing flows on a deployed staging environment with disposable users.
2. Successful sandboxed Resend delivery and verified webhook processing.
3. Supabase migrations, RLS, and mutation cleanup against a disposable staging project.
4. GitHub scheduler secrets and recent successful cron/worker runs.
5. Vercel preview/production environment alignment and post-deploy canary checks.
6. A real 10,000+ recipient load run with fake delivery, explicit thresholds, and guaranteed cleanup.
7. Candidate-package adoption and browser screenshots in BeGreen, MQ, and any other independent consumers.

Do not run those checks against customer production data or send real campaign email merely to satisfy the audit.
