# CRM Migrations

`crm` owns organization, contact, and marketing-adjacent operational data.

## Owns

- `organizations`
- `crm_contacts`
- `crm_status_log`
- `organization_members`
- `organization_invitations`
- CRM/org helper functions like `is_org_admin()` and `set_crm_status(...)`
- CRM/org RLS and triggers

## Shared boundary

Some marketing data is adjacent to CRM, but the Brightweb v1 split is:

- CRM owns operational contact and organization management
- Marketing automation remains its own future module boundary

## Dependency

Depends on:

- `core`
- `admin` when staff/admin role helpers are referenced
