# Workflow persistence transactions

Workflow node replacement, single-node deletion and activation now use service-only database functions. Apply `20260906120900_atomic_marketing_workflow_nodes.sql` before deploying the updated Marketing handlers. The canonical module history and CLI bundle carry identical forward migrations; no historical migration changes.

`replace_marketing_workflow_nodes(uuid, jsonb)` locks the workflow, checks its editable state and validates all supplied node IDs before writing. Existing IDs must belong to the workflow and may occur only once. Omit the ID for a new node; the returned rows include generated IDs for the next save. Replacement deletes omitted nodes and writes the retained/new ordered nodes in one transaction. Any error restores the prior set. Positions remain unique, with the constraint checked at statement completion so existing IDs can exchange positions. Retained nodes keep their step-history references.

`delete_marketing_workflow_node(uuid, uuid)` deletes only the requested node and normalizes remaining positions under the workflow lock. It does not replace a previously read snapshot, so concurrent additions or edits to other nodes survive. Repeating deletion of an absent node leaves the remaining set intact.

`set_marketing_workflow_status(uuid, text)` shares that lock and validates that activation has at least one node. An edit that clears the set cannot race a stale activation check. Active workflows reject node replacement and deletion until paused. Browser roles cannot execute these functions; authorized server handlers use the service client. Missing functions fail without a nontransactional fallback.

Workflow UI commands persist using their captured client, even after the editor closes. Successful results reconcile only that client's collection; only the current editor session can receive draft updates or feedback. Metadata and nodes remain two separate operations: if the node transaction fails, saved metadata and a newly created workflow ID are retained for retry. This is explicit partial-save recovery, not a claim that metadata and nodes share one transaction.

The shared integration runner starts a fresh temporary PostgreSQL cluster, loads the real module histories and runs `workflow-checks.mjs`. Tests cover reordering, retained step references, rollback after deletion, identity validation, generated-ID retry, browser-role denial, targeted deletion with concurrent edits and both activation/edit lock orders. See [invitation transactions](./invitation-transactions.md#local-database-verification) for the runner command. Existing deployed databases are not inspected or modified by these tests.

The position constraint follows PostgreSQL's [documented constraint timing](https://www.postgresql.org/docs/current/sql-set-constraints.html): a deferrable, initially immediate unique constraint is checked at statement completion. It remains unique for committed node sets.
