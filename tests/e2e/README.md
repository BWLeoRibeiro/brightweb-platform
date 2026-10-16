# Consumer acceptance

These checks have different guarantees and must not be reported interchangeably:

- `node tests/e2e/generated-app-smoke.mjs` builds and serves a generated app against a deterministic HTTP fixture. It checks rendered CSS, actual campaign/task controls, persistence within the fixture, rejected-save recovery, and HTTP contracts. Unexpected backend routes and browser errors fail. Its websocket fixture acknowledges subscriptions but does not simulate change delivery. It does **not** prove SQL, RLS, or actual database compatibility.
- `node tests/e2e/generated-app-smoke.mjs --real-backend` applies the generated migrations to a disposable, package-pinned local Supabase stack and runs the real browser journeys below. It uses workspace packages through the existing generated fixture setup; installed tarball and historical upgrade gates remain separate.
- `node tests/e2e/consumer-smoke.mjs --consumer-root /absolute/path/to/portal --migrations-directory /absolute/path/to/assembled/migrations` runs the consumer's declared `pnpm run build` with automatic dependency installation disabled, serves its installed Next version, and runs the same real backend journeys. Optional `--projects-path` and `--marketing-path` support consumer route roots. The supplied migrations must be the actual assembled consumer history; the runner never reorders or repairs them.

Real backend coverage:

1. Unauthenticated project navigation redirects to login without project content; browser password login then succeeds using actual GoTrue, cookies and application guards.
2. Task open/edit/save and exact title persistence after reload.
3. Campaign creation denied once at the browser's HTTP boundary, draft retained, retry through the real application/database, reload, update and reload again. This deliberately injected response tests recovery; it is not an RLS denial test.
4. Workflow creation with two distinguishable steps, reordering, persisted order after reload, activation and pause across reloads.
5. Invitation rejection for a different authenticated account; a real GoTrue verification callback and post-login acceptance; database role assignment and safe repeated acceptance. Invitation preparation generates a local token without sending email. External email delivery and the administrator's invitation-composition UI are outside this check.

The real suite requires Docker, the locked Supabase CLI, installed consumer dependencies, and Playwright Chromium. Missing prerequisites are failures, not skips. Backend ports/project IDs are isolated; only synthetic `example.invalid` identities are seeded. The existing consumer receives runtime environment overrides through the child process, not edits to its environment/configuration files. Build artifacts are generated normally in its build directory. Cleanup stops only the disposable stack created by this run.

Browser errors, failed first-party requests, and unexpected HTTP failures from both the application and its Supabase origin fail acceptance. Expected failures are narrowly declared inside the journey that causes them. Readiness requests and the existing-consumer build are bounded. These suites complement deterministic controller tests, database transaction/permission tests and upgrade/customization tests; they do not replace product/design judgment or claim complete realtime/external-service coverage.

## Disposable external consumer sessions

The canonical pack harness supports `node scripts/check-packed-release.mjs --external-only --consumer-driver /absolute/driver.mjs`. It versions/packs once in a disposable copy, starts a loopback-only registry, and invokes the trusted driver with `--session /temporary/session.json`. The JSON contains `contractVersion: 1`, `registryUrl`, exact `versions`, `cliRoot`, `packedArtifacts` with SHA-256 values, and synthetic local `installEnv` paths. The driver must save redacted receipts before returning; the session and registry are then deleted. Without `--external-only`, built-in fresh and historical checks also run. External-only success does not claim those omitted checks passed.

The existing-consumer runner accepts `--context-setup /absolute/hooks.mjs`; export `async setupContext(context)` to install synthetic local routes or block hosted providers before navigation. Every shared browser journey invokes this hook, including wrong-account invitation contexts. Consumers must use sanitized disposable roots and synthetic provider configuration.

The disposable Supabase backend exposes `mailSinkUrl` and `sendMagicLink({ email })`. Only `example.invalid` recipients are accepted; the helper requests GoTrue email and observes delivery in the local Mailpit API. It returns delivery metadata without tokens or message bodies. Generated and installed consumer gates require this delivery before invitation acceptance.

For consumer-specific evidence, pass `--consumer-checks /absolute/frozen-extension.mjs`. Export `async runConsumerChecks({ consumerRoot, appUrl, backend, cookies, user, project, invitedUser, invitation, setupContext })`; the runner awaits it after shared browser workflows and before canonical teardown. An optional exported `setupContext(context)` is reused for every shared browser context unless `--context-setup` explicitly selects a different module. Callback errors fail the run and still execute app/backend cleanup. Persist redacted evidence inside the callback; runtime credentials and cookies are synthetic and must not be logged.
