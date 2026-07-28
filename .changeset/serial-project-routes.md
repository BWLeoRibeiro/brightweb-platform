---
"@brightweblabs/module-projects": minor
"create-bw-app": patch
---

Make Projects page navigation serializable across React Server/Client boundaries and update generated Projects routes to pass URL patterns.

Direct `ProjectsPage`, `ProjectDetailPage`, and `ProjectTasksPage` consumers must rename the `detailHref`, `boardHref`, and optional `organizationHref` navigation callbacks to `detailHrefPattern`, `boardHrefPattern`, and optional `organizationHrefPattern` strings.
