# Existing Migration Classification

This document maps the current BeGreen migration history into Brightweb module ownership buckets.

Historical source:

- `/Users/leoribeiro/Documents/02_Projects/BeGreen/2025-12_FullIdentity/03_Work/Website/Development/be-green/supabase/migrations`

This is a classification document, not a replay plan. Existing BeGreen migrations stay in place; this mapping defines where equivalent Brightweb-owned migrations belong going forward.

## Core

- `20260105213611_remote_schema.sql`
  Shared base schema snapshot. Contains some legacy tables that should be reviewed before adopting wholesale into Brightweb.
- `20260129120000_add_marketing_contact_linked_to_profiles.sql`
  Transitional profile/contact linkage flag.
- `20260130120000_profiles_marketing_contact_id.sql`
  Profile-owned marketing contact link.
- `20260210101500_backfill_profile_identity_from_auth.sql`
  Auth/profile identity backfill.
- `20260210103000_drop_profiles_name_column.sql`
  Profile cleanup.
- `20260212110000_auth_profile_marketing_sync_triggers.sql`
  Auth confirmation/profile sync baseline.
- `20260212170000_confirmation_gated_profile_sync.sql`
  Confirmation-gated profile sync refinement.
- `20260218120000_app_activity_events.sql`
  Shared app activity/alerts foundation.
- `20260219103000_rate_limit_rpc.sql`
  Shared rate-limit helper.
- `20260222110000_notification_preferences_and_language.sql`
  Shared user notification/language preferences.

## Admin

- `20260206133000_allow_admin_for_staff_helpers.sql`
  Transitional helper broadening for admin recognition.
- `20260218100000_rbac_foundation.sql`
  RBAC foundation.
- `20260218101000_rbac_backfill_and_guards.sql`
  RBAC backfill and guarded role mutation.
- `20260218101500_profiles_staff_update_guard.sql`
  Privileged profile update guard.
- `20260218102000_rbac_cleanup_drop_profiles_user_type.sql`
  Cleanup after RBAC cutover.
- `20260218110000_rbac_single_assignment_row.sql`
  Single active assignment normalization.
- `20260218111000_rbac_drop_assignment_lifecycle_fields.sql`
  RBAC cleanup.
- `20260309143000_profile_default_role_assignment_trigger.sql`
  Default role-assignment trigger/backfill.

## CRM

- `20260206120000_phase2_crm_access_model.sql`
  Organizations, CRM contacts, CRM status log, early staff helpers.
- `20260206123000_phase2_org_members_org_courses.sql`
  Organization members and org course access.
- `20260206130000_phase2_cleanup_profiles.sql`
  Cleanup of legacy CRM-related profile fields.
- `20260212143000_harden_marketing_contacts_rls.sql`
  Contact subscription write hardening.
- `20260216100000_crm_contacts_updated_at_trigger.sql`
  CRM contacts updated-at trigger.
- `20260219124500_organizations_address_nif.sql`
  Organization details extension.
- `20260309121500_org_primary_contact_admin_membership_sync.sql`
  Org primary-contact to admin/member sync.
- `20260309130500_org_primary_contact_sync_remove_old_access.sql`
  Org primary-contact sync refinement and cleanup.
- `20260310103000_organization_invitations.sql`
  Organization invitation model.

## Projects

- `20260224170000_project_manager_v1.sql`
  Projects baseline schema and RLS.
- `20260302110000_project_lifecycle_dates.sql`
  Project lifecycle fields.
- `20260302223000_project_activity_diff_payload.sql`
  Project activity payload refinement.
- `20260302231000_project_activity_related_entities.sql`
  Related entity payload extensions.
- `20260302234500_project_task_description_diff_patch.sql`
  Task diff tracking patch.
- `20260303001000_project_activity_deletion_events_patch.sql`
  Deletion activity events.
- `20260303013000_project_cancellation_reason.sql`
  Project cancellation reason.
- `20260309144500_projects_rls_team_scope.sql`
  Team-scoped project RLS.
- `20260309151500_projects_observer_write_restrictions.sql`
  Observer write restrictions.
- `20260309154500_projects_observer_read_only_policies.sql`
  Observer read-only baseline.
- `20260309173000_project_activity_payload_project_name.sql`
  Project-name activity payload patch.

## Future Marketing Module

These are shared today in BeGreen but should become their own module instead of living inside CRM long term:

- `20260222130000_drop_marketing_active_column.sql`
- `20260222150000_resend_sync_metadata.sql`
- `20260222151000_email_event_log.sql`
- `20260222152000_marketing_send_only_cleanup.sql`
- `20260222193000_marketing_platform_v1.sql`
- `20260223101500_marketing_email_builder_v1.sql`

## Legacy / Client-Specific / Review

These should be reviewed before inclusion in Brightweb core:

- `20260302120000_deprecate_engagements_table.sql`
  Legacy cleanup for `engagements` and `deliverables`.
- learning/catalog tables from `20260105213611_remote_schema.sql`
  `courses`, `lessons`, `enrollments`, `services`, `deliverables`.

These may eventually become:

- a future learning/services module
- or remain client-specific depending on product direction

## Practical rule for new work

When creating a new migration:

- if it affects every client, put it in `core`
- if it changes RBAC or user governance, put it in `admin`
- if it changes org/contact/customer workflows, put it in `crm`
- if it changes projects/tasks/milestones/team access, put it in `projects`
- if it is one-off, put it in `clients/<slug>`
