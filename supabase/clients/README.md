# Client-Specific Migrations

This directory is reserved for true client-only schema deltas.

## Rule

Only place SQL here when the change:

- cannot be reused by other clients
- should not be part of a shared module
- is intentionally isolated to a single client deployment

## Expected shape

- `clients/begreen/...`
- `clients/<future-client-slug>/...`

If a client-specific migration later proves reusable, move the concept into the appropriate shared module and stop extending the client-only path.
