---
"@brightweblabs/module-crm": patch
"@brightweblabs/module-projects": patch
"create-bw-app": patch
---

Improve portal read performance by using planned display counts for CRM and project dashboards/lists, replacing CRM status row aggregation with head-only count queries, and adding read-path indexes to CRM and Projects module migrations.
