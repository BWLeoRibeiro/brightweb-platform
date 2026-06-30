---
"@brightweblabs/module-crm": patch
---

Use `count: "exact"` instead of `count: "planned"` when listing CRM contacts
and organizations and when computing contact status stats, so reported totals
are accurate rather than Postgres planner estimates. Adopted from the MQ
Consulting portal.
