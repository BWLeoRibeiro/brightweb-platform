---
"@brightweblabs/module-marketing": patch
---

Read marketing data with the service role instead of the caller's session.

`MarketingPage` gated on `requireServerPageRoleAccess(["staff", "admin"])` and
then reused that request-scoped client for every read. All marketing tables are
service-role-only — RLS grants no policy to `authenticated` — so:

- campaigns, topics, workflows and analytics silently returned **empty**, and
- `marketing_segments`, which additionally revokes the table grant from
  `authenticated`, threw `permission denied for table marketing_segments`.

The page therefore returned a 500, and would have rendered blank even if
segments had not been revoked. Found on a live deployment, where `/marketing`
failed with that digest while every other surface worked.

The role gate still runs against the caller's session; only the data reads use
`createServiceRoleClient()`. Apps without `SUPABASE_SECRET_DEFAULT_KEY` now get
an explicit error naming the missing variable rather than an empty page.
