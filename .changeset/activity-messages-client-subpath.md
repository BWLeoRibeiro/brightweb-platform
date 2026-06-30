---
"@brightweblabs/module-projects": patch
"@brightweblabs/module-crm": patch
---

Expose the activity message composers through a dedicated `./activity-messages`
subpath. The composers (`composeProjectMessage` / `composeCrmMessage`) are pure
and client-safe, but the package root also re-exports server-only data
functions, so importing them from the barrel pulled `server-only` into client
bundles. Import from `@brightweblabs/module-projects/activity-messages` and
`@brightweblabs/module-crm/activity-messages` in client components instead.
