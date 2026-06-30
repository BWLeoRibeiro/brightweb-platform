---
"@brightweblabs/module-projects": minor
---

Adopt MQ Consulting portal improvements as the baseline:

- Use `count: "exact"` instead of `count: "planned"` for project portfolio
  stats and project list queries so totals are accurate rather than planner
  estimates.
- `createProjectTask` now returns the single created `ProjectTask` (with
  assignee/reporter joins) instead of re-listing every task in the project.
  **Breaking:** the return type changes from `ProjectTask[]` to `ProjectTask`.
- `getProjectDashboard` no longer eagerly loads the activity feed inline; it
  fetches the project row in parallel with tasks/milestones/links/members and
  returns `activity: []`. Activity moves to a dedicated lazy-loaded query in a
  follow-up release. **Breaking:** `ProjectDashboardData.activity` is now
  always empty from this function.
