# The `bw` CLI

Generated BrightWeb apps include `.brightweb/app-manifest.json`, the machine-authoritative record of their template, installed modules, tracked scaffold files, managed files, and migration cursors. `docs/ai/app-context.json` remains the human-and-agent orientation document; it does not replace the app manifest.

## Commands

Run commands from the generated app root, or pass `--target-dir`.

```bash
bw add projects
bw upgrade
bw doctor
```

### Add a module

`bw add <moduleKey>` resolves the module's requirements in dependency order, updates package and managed config, copies its starter overlay, and appends its migrations. Use `--dry-run` to inspect the plan first. After applying it, install dependencies and run your normal Supabase migration apply command.

### Upgrade an app

`bw upgrade [moduleKey]` performs the managed package/config update and appends only migrations after each module's recorded cursor. It will not overwrite a tracked scaffold file whose recorded hash has drifted. `create-bw-app update` remains available with its original behavior for compatibility.

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

Apps without `.brightweb/app-manifest.json` need the future adoption workflow. The CLI stops with guidance instead of guessing their state.

## Related

- [Installation](./installation.md)
- [Add Modules After Scaffold](../recipes/add-modules-after-scaffold.md)
- [Using BrightWeb Modules](../modules/using-modules.md)
