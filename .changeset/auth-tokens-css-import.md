---
"@brightweblabs/core-auth": patch
---

Load `tokens.css` from the auth UI surfaces that need it.

`tokens.css` defines every `.auth-*` rule, but was imported only by
`account-page.tsx`. Consuming apps therefore rendered login, signup,
forgot-password, reset-password, invite, post-login and confirmed with no
layout at all, unless a session happened to load `/account` first and leave the
stylesheet in the page bundle. The generated `create-bw-app` scaffold does not
import it either, so a freshly scaffolded app hit this on its very first screen.

`auth-layout.tsx` now imports the stylesheet on behalf of the six pages that
compose it, and `post-login-page.tsx` imports it directly because it uses
`.auth-layout__brand-logo`, `.auth-post-login` and `.auth-spinner` without
going through `AuthLayout`. A hygiene test asserts every core-auth component
using an `.auth-*` class reaches `tokens.css` through its import graph.
