# The `bw` CLI

Generated BrightWeb apps include `.brightweb/app-manifest.json`, the machine-authoritative record of their template, installed modules, tracked scaffold files, managed files, and migration cursors. `docs/ai/app-context.json` remains the human-and-agent orientation document; it does not replace the app manifest.

## Commands

Run commands from the generated app root, or pass `--target-dir`.

```bash
bw add projects
bw adopt --dry-run
bw diff --list
bw remove crm
bw upgrade
bw doctor
```

### Add a module

`bw add <moduleKey>` resolves the module's requirements in dependency order, updates package and managed config, copies its starter overlay, and appends its migrations. Use `--dry-run` to inspect the plan first. After applying it, install dependencies and run your normal Supabase migration apply command.

### Upgrade an app

`bw upgrade [moduleKey]` performs the managed package/config update and appends only migrations after each module's recorded cursor. It will not overwrite a tracked scaffold file whose recorded hash has drifted. `create-bw-app update` remains available with its original behavior for compatibility.

An adopted module with a null migration cursor is blocked from upgrade until an operator records an explicit cursor. This prevents an unknown legacy history from being treated as a new database.

### Adopt an existing app

`bw adopt` creates `.brightweb/app-manifest.json` for an app that predates the manifest contract. It reads files only: package metadata, module exposure config, scaffold files, and local migration history. It never connects to the database and never creates, renames, edits, or deletes anything under `supabase/migrations`.

Start with a preview:

```bash
bw adopt --dry-run --owned-surface shell
bw adopt --owned-surface shell
```

Adoption records every tracked scaffold file as `current`, `drifted`, or `missing`; it does not overwrite drift or create missing files. Module migration cursors are inferred in this order:

1. `-- bw-module: <key>@...` provenance headers written by `bw upgrade`.
2. Flattened BrightWeb migration filenames.
3. A leading legacy comment such as `-- Brightweb CRM v1 baseline.`

The baseline heuristic stamps only the shipped v1 baseline. If the installed package has later migrations, adoption warns that they are unapplied and the next `bw upgrade` will plan them. If none of the strategies match, the cursor is `null`, doctor fails, and migration upgrades stay blocked. Resolve that state with a reviewed override such as:

```bash
bw adopt --force --cursor crm=20260316092000_crm_v1.sql
```

Use `--allow-uncursored` only to make the doctor result advisory while investigating; it does not unblock upgrades. Repeated `--owned-surface <name>` options record app-owned areas such as `shell` for doctor to report.

#### MQ-style legacy walkthrough

An MQ-style portal has its own baseline filenames and heavily customized starter files. Its migration may begin with `-- Brightweb CRM v1 baseline.` while the package also ships later CRM migrations. Run:

```bash
bw adopt --dry-run --owned-surface shell
```

Expected output includes drift warnings for customized routes, possibly a missing `config/shell.overrides.ts` warning, and a baseline warning that the CRM cursor was set to `20260316092000_crm_v1.sql` while later package migrations remain unapplied. Review the complete manifest preview and warnings before rerunning without `--dry-run`. Do not rename or copy legacy migration files for adoption.

### Compare scaffold drift

`bw diff <relpath>` prints a unified diff from the installed CLI template to the app's tracked scaffold file. A clean file exits successfully with `identical`. List all tracked files and their live state with:

```bash
bw diff --list
bw diff app/playground/crm/page.tsx
```

Workspace apps use `packages/create-bw-app/template`. Published mode uses the bundled template from the installed CLI; if that template is unavailable, the command warns that comparison is unsupported.

### Remove a module

`bw remove <moduleKey>` is plan-only unless `--yes` is supplied. It refuses removal when another installed module requires the target, removes package wiring and only scaffold files that still match their recorded template hash, leaves drifted files with a warning, and regenerates managed config.

```bash
bw remove crm
bw remove crm --yes
```

Removal never touches the database or migration history. It prints the module's declared owned database objects as a commented manual-removal notice. Dropping those objects is a separate deliberate operator action; applied migrations remain append-only.

### Check app health

`bw doctor` prints `PASS`, `WARN`, and `FAIL` checks for manifest validity, package/module agreement, exposure flags, module requirements, scaffold drift, required environment names, and migration files. It never prints environment values.

```bash
bw doctor --report
bw doctor --strict
```

`--report` records the timestamp and result in the app manifest. `--strict` makes warnings fail, including the current `db-objects` skip; live database checks are reserved for a later release.

## Safe workflow

1. Commit or stash app-owned work.
2. Run the desired command with `--dry-run` when available.
3. Review drift and migration output.
4. Apply the command, install dependencies, and apply migrations.
5. Run `bw doctor`, then exercise the affected routes.

Apps without `.brightweb/app-manifest.json` must run `bw adopt` before add, upgrade, diff, remove, or doctor workflows can rely on manifest state.

## Related

- [Installation](./installation.md)
- [Add Modules After Scaffold](../recipes/add-modules-after-scaffold.md)
- [Using BrightWeb Modules](../modules/using-modules.md)
