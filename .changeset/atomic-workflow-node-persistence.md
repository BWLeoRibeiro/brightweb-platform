---
"@brightweblabs/module-marketing": patch
"create-bw-app": patch
---

Save workflow nodes in one service-only transaction, preserving retained node identities across reordering and rolling back deletions if any write fails. Reject foreign, missing or duplicate supplied node IDs. Delete individual nodes through a targeted transaction that preserves concurrent changes to other nodes. Serialize activation with node editing so a concurrent edit cannot activate an empty workflow. Existing applications must apply the atomic_marketing_workflow_nodes migration before upgrading the handlers; fresh applications include the mirrored migration.
