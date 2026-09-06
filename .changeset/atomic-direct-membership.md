---
"@brightweblabs/module-orgs": patch
"create-bw-app": patch
---

Assign existing organization members through a service-only database transaction so membership, CRM linking, primary-contact selection and pending-invitation reconciliation commit together. Remove snapshot-based compensation that could delete concurrent grants or restore stale roles. Preserve per-person batch outcomes and the client-owned transactional contact hook. Custom asynchronous callbacks must migrate to that hook and explicitly acknowledge database integration before use. Existing applications must apply the new atomic direct-membership migration before upgrading the handlers; new applications include the mirrored migration.
