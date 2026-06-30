---
"@brightweblabs/module-projects": minor
---

Add `listProjectActivity(supabase, projectId)`, a dedicated, lazy-loadable
project activity query adopted from the MQ Consulting portal. It merges
payload-referenced and directly-attributed `app_activity_events`, dedupes and
caps the feed at 50 rows, and resolves every referenced profile id (actor plus
member ids in `member_*`/`project_members_synced` payloads) to display names in
a single query — enriching the payload with `profile_name`/`*_profile_names`
so consumers render people instead of raw ids. Pairs with `getProjectDashboard`
no longer loading activity inline (see previous release).
