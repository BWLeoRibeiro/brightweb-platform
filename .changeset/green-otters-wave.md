---
"@brightweblabs/core-auth": minor
"@brightweblabs/ui": minor
"@brightweblabs/app-shell": minor
"@brightweblabs/module-admin": minor
"create-bw-app": minor
---

Refactor package boundaries across the workspace and align the preview sandbox setup.

- add explicit `@brightweblabs/core-auth/shared` exports and remove the root `core-auth` barrel in favor of canonical `shared`, `client`, and `server` entrypoints
- add UI subpath exports and update first-party consumers to import directly from those package entrypoints
- simplify app-shell navigation primitives and refresh the platform preview sandbox copy to reflect its internal sandbox role
- update `create-bw-app` templates and generator metadata to match the new preview app and package import surfaces
