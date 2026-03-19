# Admin Migrations

`admin` owns user governance, RBAC, and privileged role-management behavior.

## Owns

- `roles`
- `user_role_assignments`
- `role_change_audit`
- admin-only helper functions like `admin_set_user_role(...)`
- privileged profile-field guards
- default role-assignment triggers/backfills

## Dependency

Depends on:

- `core` (`profiles`, `current_profile_id()`, auth linkage)
