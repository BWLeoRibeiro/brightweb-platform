---
"@brightweblabs/module-orgs": patch
---

Republish with resolved dependency ranges. 0.2.0 was published manually (npm publish) which bypassed workspace-protocol rewriting, shipping a literal `workspace:*` dependency on @brightweblabs/app-shell that is unresolvable for consumers. No code changes.
