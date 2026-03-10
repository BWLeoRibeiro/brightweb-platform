# npm Publishing Setup

This repository publishes public scoped packages under `@brightweblabs/*`.

## Requirements

1. Own or control the `@brightweblabs` npm scope.
2. Create an npm automation token.
3. Add `NPM_TOKEN` to the GitHub repository secrets.

## First-time npm setup

1. Log into npm with the account that owns the `@brightweblabs` scope.
2. Confirm the scope exists and can publish public packages.
3. Create an automation token in npm.
4. Add that token to GitHub as `NPM_TOKEN`.

## Release flow

1. Add a changeset:

```bash
pnpm changeset
```

2. Merge the resulting changeset PR or your feature PR into `main`.
3. GitHub Actions creates or updates a release PR.
4. Merge the release PR.
5. GitHub Actions publishes the changed `@brightweblabs/*` packages to npm.

## Local publish testing

To dry-run release state locally:

```bash
pnpm release:check
```

To version packages locally:

```bash
pnpm release:version
```

To publish manually after authenticating with npm:

```bash
pnpm release:publish
```

## Important note

Public npm publishing is separate from GitHub visibility. A public GitHub repo does not automatically grant ownership of the `@brightweblabs` npm scope.
