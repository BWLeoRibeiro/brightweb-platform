---
"create-bw-app": patch
---

Resolve published `@brightweblabs/*` update targets from npm at update time.

`create-bw-app update` now looks up installed BrightWeb package versions from the npm registry when it runs in published mode, instead of relying only on the CLI's baked-in version map. Published updates now fail fast when registry resolution fails, with an explicit `--allow-stale-fallback` escape hatch for intentionally using the baked-in fallback versions.
