# Organizations Module

The Organizations module is the shared foundation for organization records, membership, invitations, and organization access checks. CRM and Projects both depend on it.

> Organizations is not independently selectable. The scaffolder enables it automatically, with hidden shell placement, whenever CRM or Projects is selected.

## What it installs

- The organizations, organization_members, and organization_invitations tables
- The is_org_admin() and is_org_member() helpers
- Staff, organization-admin, member, and invitation RLS policies
- 14-day invitation expiry and admin or member roles

The organizations baseline installs without CRM. When CRM is present, CRM's integration migration adds the accepted-contact foreign key to crm_contacts and the primary-contact admin synchronization trigger.

## Package contract

@brightweblabs/module-orgs exports organization list/create/update helpers and organization membership list/admin helpers. Its orgsModuleRegistration uses hidden placement so it can participate in shell configuration without adding navigation.

See [Base Contract](./base-contract.md) for support tiers and [Using BrightWeb Modules](./using-modules.md) for integration guidance.

## Implementation references

- packages/module-orgs/src
- supabase/modules/orgs/migrations
- supabase/module-registry.json
