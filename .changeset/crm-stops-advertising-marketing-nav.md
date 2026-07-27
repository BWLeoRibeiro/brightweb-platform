---
"@brightweblabs/module-crm": minor
---

Stop advertising a Marketing route from the CRM nav.

`module-crm` put an "Email Marketing" item at `/admin/marketing` inside its own
nav group. `module-marketing` depends on `module-crm`, never the reverse, so
this inverted the declared dependency — and it 404'd in both configurations:

- **Marketing enabled** — duplicated, and wrong. `module-marketing` registers
  its own group at `/marketing`, which is where the surface actually mounts, so
  the CRM copy pointed at a route no scaffolded app generates.
- **Marketing disabled** — CRM advertised a module the app did not even have.

The item is removed; `module-marketing` already contributes the nav for its own
surface. Apps that rewrote the href through `shell.overrides.ts` (the workaround
the `create-bw-app` template documents) can drop that override — the nav now
comes from the module that owns the route.

A hygiene test asserts no module registration links a route owned by another
module, so the boundary is enforced rather than remembered.
