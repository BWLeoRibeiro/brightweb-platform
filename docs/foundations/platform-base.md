# Platform Base

In practice, the base platform install is **Core + Admin**. That is the current working model in this repo, and the docs should be read through that lens.

> When the generator resolves the database stack in workspace mode, it always keeps Admin governance enabled for platform auth and RBAC even if the admin UI module is not selected as a starter surface.

## What Core installs

- `profiles` as the baseline profile identity table.
- Shared helper functions such as `current_profile_id()`, plus placeholder role helpers later replaced by Admin.
- `app_activity_events` for shared activity and event recording.
- `user_preferences` and `user_notification_state` for shared user state.
- Rate-limit and shared auth/profile sync foundations used across the platform.

## What Admin installs

- `roles`, `user_role_assignments`, and `role_change_audit`.
- RBAC helper functions such as `current_global_role()`, `has_role()`, `is_staff()`, and `is_admin()`.
- Default role-assignment behavior for new profiles and guardrails around staff and admin role mutation.
- Shared governance behavior that CRM and Projects both rely on.

## Separate governance from UI starter surfaces

| Concern | Current repo truth |
| --- | --- |
| Admin governance / RBAC | Part of the practical platform base. The database plan keeps Admin governance enabled for platform auth and role control. |
| Admin package UI surface | Optional starter surface. Selecting the Admin module controls copied playground and API starter files plus package wiring, not whether RBAC exists at all. |
| Base-only mental model | Treat base-only as Core + Admin governance, not Core in isolation. |

## What this means for new client apps

- "Base only" still includes RBAC and user governance foundations.
- Optional business modules build on top of that base rather than redefining it.
- If you describe the base as only Core, you will understate how the current generator and module dependencies actually behave.

## Related docs

- [Getting Started](./getting-started.md)
- [Modules](../modules/README.md)
- [Dependency Resolution](../architecture/dependency-resolution.md)

## Repo sources

- `README.md`
- `packages/create-bw-app/src/generator.mjs`
- `supabase/module-registry.json`
- `supabase/modules/core/migrations`
- `supabase/modules/admin/migrations`
