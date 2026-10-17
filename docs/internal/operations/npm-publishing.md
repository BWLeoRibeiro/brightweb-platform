# npm Publishing Setup

This repository publishes public scoped packages under `@brightweblabs/*` and the unscoped `create-bw-app` CLI package through `.github/workflows/release.yml`.

## Trusted publishing requirements

1. Maintain npm ownership or publish access for the `@brightweblabs` packages and `create-bw-app`.
2. Configure each package's trusted publisher for the GitHub owner `BWLeoRibeiro`, repository `brightweb-platform`, and workflow filename `release.yml`. Enter only the workflow filename in npm, not its full path.
3. Keep the workflow on a GitHub-hosted runner with `id-token: write`. The existing release job uses npm trusted publishing with short-lived OIDC authentication; it does not require a long-lived `NPM_TOKEN` secret.

The workflow currently has no GitHub environment binding. A trusted-publisher environment restriction must match the workflow if one is introduced later. See [npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/) for account-side configuration.

## Release flow

1. Add a changeset alongside each publishable package change:

```bash
pnpm changeset
```

2. Open the feature PR, complete CI, and merge it into `main`.
3. After successful main CI, GitHub Actions creates or updates the Changesets version PR.
4. Review the version PR and merge it after its checks pass.
5. CI verifies the versioned main commit. The release workflow checks that the successful CI commit is still current main before publishing changed packages to npm.

The automated version step runs `pnpm release:version`: Changesets updates versions and changelogs, then regenerates `brightweb-release.json` and the BrightWeb caret ranges in `packages/create-bw-app/src/constants.mjs`. This keeps the compatibility set and generated app dependency defaults aligned before CI validates them.

## Local release inspection

Check the pending release plan without publishing:

```bash
pnpm release:check
```

To inspect the exact versioning output, run `pnpm release:version` in a disposable checkout. That command writes versions, changelogs and compatibility metadata; the normal release workflow performs these writes in the automated version PR.

## Manual publishing exception

Manual publishing requires an explicit request from the repository owner. When requested, verify the npm version before and after publishing and confirm CI will not republish that same version. If a package was already manually published, record an empty changeset and explain the existing publication instead of scheduling it again.

The release command is `pnpm release:publish`; running it is a publication action, not a local validation step.

## Package ownership

Public npm publishing is separate from GitHub visibility. A public GitHub repo does not automatically grant ownership of the `@brightweblabs` npm scope or the unscoped `create-bw-app` package name.

The retired marketing core stub was never a runtime dependency. The current `@brightweblabs/module-marketing` package is the supported Marketing runtime and follows the same Changesets release flow as the other scoped packages.
